"""
Supplier Form — Service Layer

All business logic for the supplier form workflow lives here.
Views call these functions; they handle HTTP concerns only.
"""

import logging
import uuid

from django.conf import settings
from django.utils import timezone

from .models import SupplierForm, FormLink
from .reviewers import first_supplier_reviewer, supplier_reviewers
from .emails import (
    send_initial_email_async,
    send_reactivation_email,
    send_section_notification,
    send_completion_email,
    send_reversal_email,
)

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────────

def _clean_amount(raw_value):
    """Parse a currency string into a float, or return None."""
    if raw_value == "" or raw_value is None:
        return None
    try:
        clean = "".join(c for c in str(raw_value) if c.isdigit() or c == ".")
        return float(clean) if clean else None
    except (ValueError, TypeError):
        return None


def _get_workflow_reviewers() -> dict:
    """Return all active workflow reviewer emails grouped by section.

    Backed by the SupplierReviewer model (see supplier_form/reviewers.py).
    Editable via Django admin without a redeploy.
    """
    return {
        "section_a": supplier_reviewers('A'),
        "section_b": supplier_reviewers('B'),
        "section_c": supplier_reviewers('C'),
        "section_d": supplier_reviewers('D'),
    }


# ─── Service: Create form + link ─────────────────────────────────────────────────

def create_supplier_form(*, email: str, data: dict) -> SupplierForm:
    """
    Create a new SupplierForm with an access link and send the initial email.

    Args:
        email: Initiator/supplier email address.
        data: Request payload with optional pre-filled form fields.

    Returns:
        The created SupplierForm instance.

    Raises:
        ValueError: If email is not provided.
    """
    if not email:
        raise ValueError("Supplier email is required to generate a link.")

    serial_no = SupplierForm.generate_serial()

    form = SupplierForm.objects.create(
        serial_no=serial_no,
        status="SECTION_A_PENDING",
        invoice_no=data.get("invoice_no", ""),
        supplier_name=data.get("supplier_name", ""),
        po_number=data.get("po_number", ""),
        contract_date=data.get("contract_date") or None,
        commodity_type=data.get("commodity_type", ""),
        contract_value_currency=data.get("contract_value_currency", "KES"),
        contract_value_amount=_clean_amount(data.get("contract_value_amount")),
        designated_program=data.get("designated_program", ""),
        report_date=timezone.now().date(),
        initiator_email=email,
    )

    link = FormLink.objects.create(form=form, target_email=email)
    fill_url = f"{settings.FRONTEND_BASE_URL}/supplier?token={link.token}"

    send_initial_email_async(form.serial_no, form.supplier_name, email, fill_url)

    return form


# ─── Service: Reactivate link ────────────────────────────────────────────────────

def reactivate_link(form_pk: int) -> dict:
    """
    Reactivate an expired/deactivated link for a form.

    Returns:
        dict with 'token' and 'url' keys.

    Raises:
        SupplierForm.DoesNotExist: If form not found.
    """
    form = SupplierForm.objects.get(pk=form_pk)
    link = form.access_link

    link.is_active = True
    link.token = uuid.uuid4()
    link.save()

    fill_url = f"{settings.FRONTEND_BASE_URL}/supplierForm/fill?token={link.token}"
    send_reactivation_email(form, fill_url)

    return {"token": str(link.token), "url": fill_url}


# ─── Service: Submit section ─────────────────────────────────────────────────────

def submit_section(*, token: str, section_data: dict | None, signature: str,
                   next_email: str | None, particulars: dict | None) -> SupplierForm:
    """
    Submit a section of the supplier form and advance the workflow.

    This is the core state machine:
      SECTION_A_PENDING → SECTION_B_PENDING → SECTION_C_PENDING → SECTION_D_PENDING → COMPLETED

    At each stage, data is saved, the token is rotated, and the next reviewer is notified.

    Args:
        token: Active FormLink token.
        section_data: JSON data for the current section.
        signature: Base64 signature string.
        next_email: Email of the next reviewer (from frontend dropdown or auto-detected).
        particulars: Core form fields updated during Section A.

    Returns:
        The updated SupplierForm instance.

    Raises:
        FormLink.DoesNotExist: If token is invalid or consumed.
    """
    link = FormLink.objects.get(token=token, is_active=True)
    form = link.form

    # No top-of-function next_email auto-detect: the pre-DB code assigned the
    # literal strings "WORKFLOW_REVIEWER_C"/"_D" here based on the CURRENT
    # status, which is backwards (a C→D transition needs D's primary, not
    # C's). The state machine below already picks the correct NEXT section's
    # primary via `next_email or first_supplier_reviewer(...)`, so that block
    # was always dead on the happy path and wrong on the fallback path.
    workflow_decision = (section_data or {}).get("workflow_decision")
    is_backwards = workflow_decision in ["Payment on hold (Clarification)", "Rejected"]

    logger.info("Submission for %s: status=%s, decision=%s, next=%s",
                form.serial_no, form.status, workflow_decision, next_email)

    # ── State machine ──
    if form.status == "SECTION_A_PENDING":
        form.section_1_data = section_data
        form.section_1_signature = signature
        form.section_1_email = link.target_email
        _apply_particulars(form, particulars)
        form.status = "SECTION_B_PENDING"
        next_email = next_email or first_supplier_reviewer('B')

    elif form.status == "SECTION_B_PENDING":
        form.section_2_data = section_data
        form.section_2_signature = signature
        form.section_2_email = link.target_email
        if is_backwards:
            form.status = "SECTION_A_PENDING"
            next_email = form.section_1_email
        else:
            form.status = "SECTION_C_PENDING"
            next_email = next_email or first_supplier_reviewer('C')

    elif form.status == "SECTION_C_PENDING":
        form.section_3_data = section_data
        form.section_3_signature = signature
        form.section_3_email = link.target_email
        if is_backwards:
            form.status = "SECTION_B_PENDING"
            next_email = form.section_2_email
        else:
            form.status = "SECTION_D_PENDING"
            next_email = next_email or first_supplier_reviewer('D')

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

    if next_email and form.status != "COMPLETED":
        send_section_notification(form, link, next_email, sender_email, workflow_decision)
    elif form.status == "COMPLETED":
        logger.info("Submission complete for form %s", form.serial_no)
        send_completion_email(form, link, sender_email)

    return form


def _apply_particulars(form: SupplierForm, particulars: dict | None):
    """Apply Section A particulars (core fields) to the form."""
    if not particulars:
        return
    form.invoice_no = particulars.get("invoice_no", form.invoice_no)
    form.supplier_name = particulars.get("supplier_name", form.supplier_name)
    form.po_number = particulars.get("po_number", form.po_number)
    form.commodity_type = particulars.get("commodity_type", form.commodity_type)
    form.designated_program = particulars.get("designated_program", form.designated_program)
    form.contract_value_currency = particulars.get("contract_value_currency", form.contract_value_currency)

    amount = particulars.get("contract_value_amount")
    if amount:
        cleaned = _clean_amount(amount)
        if cleaned is not None:
            form.contract_value_amount = cleaned

    r_date = particulars.get("report_date")
    if r_date:
        form.report_date = r_date


# ─── Service: Reverse section ────────────────────────────────────────────────────

def reverse_section(*, token: str, next_email: str | None, note: str = "") -> SupplierForm:
    """
    Revert the form to the previous section.

    Args:
        token: Active FormLink token.
        next_email: Email of the previous reviewer (auto-detected if not provided).
        note: Optional note from the reverting reviewer.

    Returns:
        The updated SupplierForm instance.

    Raises:
        FormLink.DoesNotExist: If token is invalid or consumed.
    """
    link = FormLink.objects.get(token=token, is_active=True)
    form = link.form
    old_status = form.get_status_display()

    # Auto-detect previous reviewer.
    # The pre-DB code referenced settings.WORKFLOW_REVIEWER_A/B/C without
    # the _N suffix — those settings never existed and would have raised
    # AttributeError if this fallback ever fired. Now we resolve to the
    # section's primary reviewer in the SupplierReviewer table.
    if not next_email:
        if form.status == "SECTION_B_PENDING":
            next_email = form.section_1_email or form.initiator_email or first_supplier_reviewer('A')
        elif form.status == "SECTION_C_PENDING":
            next_email = form.section_2_email or first_supplier_reviewer('B')
        elif form.status == "SECTION_D_PENDING":
            next_email = form.section_3_email or first_supplier_reviewer('C')

    # Step back
    STATUS_PREV = {
        "SECTION_B_PENDING": "SECTION_A_PENDING",
        "SECTION_C_PENDING": "SECTION_B_PENDING",
        "SECTION_D_PENDING": "SECTION_C_PENDING",
    }
    form.status = STATUS_PREV.get(form.status, form.status)
    form.save()

    # Rotate token
    sender_email = link.target_email
    link.token = uuid.uuid4()
    if next_email:
        link.target_email = next_email
    link.save()

    if next_email:
        send_reversal_email(form, link, next_email, sender_email, old_status, note)

    return form


# ─── Service: Delete form ────────────────────────────────────────────────────────

def delete_supplier_form(form_pk: int) -> None:
    """
    Delete a supplier form and its associated link.

    Raises:
        SupplierForm.DoesNotExist: If form not found.
    """
    form = SupplierForm.objects.get(pk=form_pk)
    form.delete()
