"""
Department Form — Service Layer

All business logic for the department form workflow.
Key difference from supplier_form: strict reviewer routing (not dropdown-based).
"""

import logging
import uuid

from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from .models import DepartmentForm, FormLink
from .reviewers import department_reviewer
from .emails import (
    send_initial_email_async,
    send_section_notification,
    send_completion_email,
    send_reversal_email,
)

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────────

def _clean_amount(raw_value):
    if raw_value == "" or raw_value is None:
        return None
    try:
        clean = "".join(c for c in str(raw_value) if c.isdigit() or c == ".")
        return float(clean) if clean else None
    except (ValueError, TypeError):
        return None


def get_workflow_config() -> dict:
    """Return department workflow reviewer emails.

    Backed by the DepartmentReviewer model (see department_form/reviewers.py).
    Editable via Django admin without a redeploy.
    """
    return {
        "dropdown_emails": [
            department_reviewer('A'),
            department_reviewer('B'),
        ],
        "section_c_email": department_reviewer('C'),
        "section_d_email": department_reviewer('D'),
    }


# ─── Service: Create form ────────────────────────────────────────────────────────

def create_department_form(*, email: str, data: dict) -> DepartmentForm:
    """
    Create a new DepartmentForm with an access link and send the initial email.

    Raises:
        ValueError: If email is not provided.
    """
    if not email:
        raise ValueError("Department email is required to generate a link.")

    serial_no = DepartmentForm.generate_serial()

    form = DepartmentForm.objects.create(
        serial_no=serial_no,
        status="SECTION_A_PENDING",
        invoice_no=data.get("invoice_no", ""),
        department_name=data.get("department_name", ""),
        po_number=data.get("po_number", ""),
        contract_date=data.get("contract_date") or None,
        commodity_type=data.get("commodity_type", ""),
        contract_value_currency=data.get("contract_value_currency", "KES"),
        contract_value_amount=_clean_amount(data.get("contract_value_amount")),
        designated_program=data.get("designated_program", ""),
        report_date=timezone.now().date(),
        initiator_email=email,
    )

    # STRICT: First section always goes to Reviewer A
    link_recipient = department_reviewer('A')
    expires_at = timezone.now() + timedelta(hours=48)
    FormLink.objects.create(form=form, target_email=link_recipient, expires_at=expires_at)

    send_initial_email_async(form, email)

    return form


# ─── Service: Reactivate link ────────────────────────────────────────────────────

def reactivate_link(form_pk: int) -> None:
    """
    Reactivate an expired/deactivated link.

    Raises:
        DepartmentForm.DoesNotExist
    """
    form = DepartmentForm.objects.get(pk=form_pk)
    link = form.access_link
    link.expires_at = timezone.now() + timedelta(hours=48)
    link.is_active = True
    link.token = uuid.uuid4()
    link.save()


# ─── Service: Submit section ─────────────────────────────────────────────────────

def submit_section(*, token: str, section_data: dict | None, signature: str,
                   next_email: str | None, particulars: dict | None) -> DepartmentForm:
    """
    Submit a section and advance the department form workflow.

    Key difference from supplier: strict reviewer routing, different decision keys per section.

    Raises:
        FormLink.DoesNotExist: If token is invalid.
        RuntimeError: If email notification fails (form is still saved).
    """
    link = FormLink.objects.get(token=token, is_active=True)
    form = link.form

    # No top-of-function next_email auto-detect: the pre-DB code assigned
    # DEPARTMENT_WORKFLOW_REVIEWER_C/D here based on the CURRENT status,
    # which is backwards (a C→D transition needs D's reviewer, not C's).
    # The state machine below already picks the correct NEXT section's
    # reviewer, so that block was always dead on the happy path and wrong
    # on the fallback path. Mirrors the same cleanup done in supplier_form.
    # Decision key varies by section
    decision_key = "workflow_decision"
    if form.status == "SECTION_B_PENDING":
        decision_key = "recommended_action_b"
    elif form.status == "SECTION_C_PENDING":
        decision_key = "approval_payment_c"

    workflow_decision = (section_data or {}).get(decision_key)
    is_backwards = False
    if workflow_decision:
        decision_lower = str(workflow_decision).lower()
        is_backwards = "hold" in decision_lower or "rejected" in decision_lower

    logger.debug("Submission: form=%s status=%s decision=%s next=%s",
                 form.serial_no, form.status, workflow_decision, next_email)

    # ── State machine ──
    if form.status == "SECTION_A_PENDING":
        form.section_1_data = section_data
        form.section_1_signature = signature
        form.section_1_email = link.target_email
        _apply_particulars(form, particulars)
        form.status = "SECTION_B_PENDING"
        next_email = department_reviewer('B')  # STRICT

    elif form.status == "SECTION_B_PENDING":
        form.section_2_data = section_data
        form.section_2_signature = signature
        form.section_2_email = link.target_email
        if is_backwards:
            form.status = "SECTION_A_PENDING"
            next_email = form.section_1_email
        else:
            form.status = "SECTION_C_PENDING"
            next_email = department_reviewer('C')

    elif form.status == "SECTION_C_PENDING":
        form.section_3_data = section_data
        form.section_3_signature = signature
        form.section_3_email = link.target_email
        if is_backwards:
            form.status = "SECTION_B_PENDING"
            next_email = form.section_2_email
        else:
            form.status = "SECTION_D_PENDING"
            next_email = department_reviewer('D')

    elif form.status == "SECTION_D_PENDING":
        form.supervisor_data = section_data
        form.supervisor_signature = signature
        form.supervisor_email = link.target_email
        if is_backwards:
            form.status = "SECTION_C_PENDING"
            next_email = form.section_3_email
        else:
            form.status = "COMPLETED"

    form.save()

    # ── Token rotation & notifications ──
    sender_email = link.target_email
    link.token = uuid.uuid4()
    if next_email and form.status != "COMPLETED":
        link.target_email = next_email
    link.save()

    email_failed = False
    if next_email and form.status != "COMPLETED":
        try:
            send_section_notification(form, link, next_email, sender_email, workflow_decision, is_backwards)
        except Exception:  # noqa: BLE001 — email send wrapper: any failure is reported via email_failed flag, form state advances
            email_failed = True

    elif form.status == "COMPLETED":
        logger.info("Submission complete for form %s", form.serial_no)
        send_completion_email(form, link, sender_email)

    if email_failed:
        raise RuntimeError("Form saved but email notification failed")

    return form


def _apply_particulars(form: DepartmentForm, particulars: dict | None):
    """Apply Section A particulars to the form."""
    if not particulars:
        return
    form.invoice_no = particulars.get("invoice_no", form.invoice_no)
    form.department_name = particulars.get("department_name", form.department_name)
    form.po_number = particulars.get("po_number", form.po_number)
    form.commodity_type = particulars.get("commodity_type", form.commodity_type)
    form.designated_program = particulars.get("designated_program", form.designated_program)
    form.contract_value_currency = particulars.get("contract_value_currency", form.contract_value_currency)

    amount = particulars.get("contract_value_amount")
    if amount:
        cleaned = _clean_amount(amount)
        if cleaned is not None:
            form.contract_value_amount = cleaned

    c_date = particulars.get("contract_date")
    if c_date:
        form.contract_date = c_date

    r_date = particulars.get("report_date")
    if r_date:
        form.report_date = r_date


# ─── Service: Reverse section ────────────────────────────────────────────────────

def reverse_section(*, token: str, next_email: str | None, note: str = "") -> DepartmentForm:
    """
    Revert the form to the previous section.

    Raises:
        FormLink.DoesNotExist: If token is invalid.
    """
    link = FormLink.objects.get(token=token, is_active=True)
    form = link.form
    old_status = form.get_status_display()

    STATUS_PREV = {
        "SECTION_B_PENDING": "SECTION_A_PENDING",
        "SECTION_C_PENDING": "SECTION_B_PENDING",
        "SECTION_D_PENDING": "SECTION_C_PENDING",
    }
    form.status = STATUS_PREV.get(form.status, form.status)
    form.save()

    sender_email = link.target_email
    link.token = uuid.uuid4()
    if next_email:
        link.target_email = next_email
    link.save()

    if next_email:
        send_reversal_email(form, link, next_email, sender_email, old_status, note)

    return form


# ─── Service: Delete form ────────────────────────────────────────────────────────

def delete_department_form(form_pk: int) -> None:
    """
    Delete a department form.

    Raises:
        DepartmentForm.DoesNotExist
    """
    form = DepartmentForm.objects.get(pk=form_pk)
    form.delete()
