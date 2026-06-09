"""
Supplier Form — Email Templates & Dispatch

All email HTML templates and sending logic extracted from views.
Each function builds an HTML email and sends it via the configured email backend.
"""

import logging
import smtplib
import threading

import requests
from django.conf import settings
from utils.email_service import send_email as send_email_via_sendgrid

logger = logging.getLogger(__name__)

# Failure modes from utils.email_service.send_email — covers the SendGrid
# HTTP path (requests.RequestException) and any SMTP fallback (smtplib +
# OSError for connection errors). Workflow code always continues on email
# failure: a missed notification must not block the form-state transition.
_EMAIL_ERRORS = (requests.RequestException, smtplib.SMTPException, OSError, ValueError)


# ─── Shared HTML wrapper ────────────────────────────────────────────────────────

def _wrap_html(body_content: str) -> str:
    """Wrap inner content in a styled HTML email shell."""
    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            {body_content}
            <hr style="margin: 32px 0; border: 0; border-top: 1px solid #e2e8f0;" />
            <p style="font-size: 12px; color: #64748b;">This is an automated notification from the Procurement System.</p>
        </div>
    </body>
    </html>
    """


def _link_fallback(url: str) -> str:
    return f'<p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">If the button above doesn\'t work, copy and paste this link into your browser:<br>{url}</p>'


def _button(url: str, text: str, color: str = "#2563eb") -> str:
    return f'<a href="{url}" style="display: inline-block; padding: 12px 24px; background: {color}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">{text}</a>'


def _info_box(items: list[tuple[str, str]], color: str = "#3b82f6", bg: str = "#f8fafc") -> str:
    lines = "".join(
        f'<p style="margin: {"0" if i == 0 else "4px 0 0"}; font-size: 14px;"><strong>{k}:</strong> {v}</p>'
        for i, (k, v) in enumerate(items)
    )
    return f'<div style="margin: 24px 0; padding: 16px; background: {bg}; border-left: 4px solid {color};">{lines}</div>'


# ─── Email: Initial form created ────────────────────────────────────────────────

def send_initial_email_async(serial_no: str, supplier_name: str, recipient_email: str, fill_url: str):
    """Send the initial review-required email in a background thread."""

    def _send():
        try:
            supplier_display = supplier_name or "a supplier"
            subject = f"Payment Authorization - New Review Required ({serial_no})"

            body = f"""
                <h2 style="color: #2563eb;">Payment Authorization</h2>
                <p>Dear Reviewer,</p>
                <p>A new Payment Authorization for <strong>{supplier_display}</strong> has been initiated and requires your review.</p>
                {_info_box([
                    ("Serial No", serial_no),
                    ("Section", "A - Contract Compliance"),
                    ("Initiated by", recipient_email),
                ])}
                <p>Please click the button below to access the form and complete your section:</p>
                {_button(fill_url, "Start Review")}
                {_link_fallback(fill_url)}
            """

            success = send_email_via_sendgrid(
                to_email=recipient_email,
                subject=subject,
                html_content=_wrap_html(body),
            )
            if success:
                logger.info("Initial email sent to %s for form %s", recipient_email, serial_no)
            else:
                logger.error("Failed to send initial email to %s for form %s", recipient_email, serial_no)
        except _EMAIL_ERRORS:
            logger.error("Initial email thread FAILED for %s (form %s)", recipient_email, serial_no, exc_info=True)

    threading.Thread(target=_send, daemon=True).start()


# ─── Email: Reactivation ────────────────────────────────────────────────────────

def send_reactivation_email(form, fill_url: str):
    """Send a link-reactivated notification to the current reviewer."""
    try:
        recipient_email = form.access_link.target_email
        subject = f"Payment Authorization - Link Reactivated ({form.serial_no})"

        body = f"""
            <h2 style="color: #6366f1;">Form Access Reactivated</h2>
            <p>Dear Reviewer,</p>
            <p>The access link for <strong>{form.supplier_name or 'a supplier'}</strong> has been reactivated by the administrator.</p>
            {_info_box([
                ("Serial No", form.serial_no),
                ("Status", form.get_status_display()),
            ], color="#6366f1", bg="#f5f3ff")}
            <p>Please click the button below to access the form:</p>
            {_button(fill_url, "Access Form", "#6366f1")}
            {_link_fallback(fill_url)}
        """

        send_email_via_sendgrid(to_email=recipient_email, subject=subject, html_content=_wrap_html(body))
        logger.info("Reactivation email sent to %s for form %s", recipient_email, form.serial_no)
    except _EMAIL_ERRORS:
        logger.error("Failed to send reactivation email for form %s", form.serial_no, exc_info=True)


# ─── Email: Section submission notification ──────────────────────────────────────

def send_section_notification(form, link, next_email: str, sender_email: str, workflow_decision: str | None):
    """Send notification to the next reviewer after a section submission."""
    try:
        is_back = workflow_decision in ["Payment on hold (Clarification)", "Rejected"]

        if is_back:
            subject = f"Payment Authorization - Clarification Required ({form.serial_no})"
            color = "#dc2626"
            header = "Clarification Required / Form Reverted"
            action = "Review and Correct"
            btn_text = "Open Form"
        else:
            subject = f"Payment Authorization - Action Required ({form.serial_no})"
            color = "#2563eb"
            header = "Action Required: Review Submission"
            action = "submitted for your review"
            btn_text = "Review Report"

        fill_url = f"{settings.FRONTEND_BASE_URL}/supplier?token={link.token}"

        body = f"""
            <h2 style="color: {color};">{header}</h2>
            <p>Dear Reviewer,</p>
            <p>A Payment Authorization for <strong>{form.supplier_name}</strong> has been {action} by <strong>{sender_email}</strong>.</p>
            {_info_box([
                ("Serial No", form.serial_no),
                ("Current Status", form.get_status_display()),
                ("Action Taken", workflow_decision or "Submitted"),
                ("Last Actor", sender_email),
            ], color=color)}
            <p>Please click the button below to access the form and take the necessary action:</p>
            {_button(fill_url, btn_text, color)}
            {_link_fallback(fill_url)}
        """

        success = send_email_via_sendgrid(
            to_email=next_email, subject=subject,
            html_content=_wrap_html(body), reply_to=sender_email,
        )
        if success:
            logger.info("Email sent to %s for form %s", next_email, form.serial_no)
        else:
            logger.warning("Email failed for %s (form %s) — form saved, continuing", next_email, form.serial_no)
    except _EMAIL_ERRORS:
        logger.error("Email notification failed for %s (form %s)", next_email, form.serial_no, exc_info=True)


# ─── Email: Completion summary ───────────────────────────────────────────────────

def send_completion_email(form, link, sender_email: str):
    """Send a summary email to a fixed recipient list plus the initiator when the form is completed."""
    try:
        last_approver = form.supervisor_email

        raw_participants = [
            "watituj@who.int",
            "akombot@who.int",
            "bagaragazae@who.int",
            form.initiator_email,
        ]
        participants = []
        for p in raw_participants:
            if p and p not in participants and p != last_approver:
                participants.append(p)

        if not participants:
            return

        fill_url = f"{settings.FRONTEND_BASE_URL}/supplierForm/fill?token={link.token}"
        supplier_display = form.supplier_name or "the supplier"
        subject = f"Payment Authorization Approved ({form.serial_no})"

        body = f"""
            <h2 style="color: #10b981;">Form Approved &amp; Completed</h2>
            <p>Dear Team,</p>
            <p>The Payment Authorization for <strong>{supplier_display}</strong> has been fully reviewed and approved by <strong>{last_approver}</strong>.</p>
            {_info_box([
                ("Serial No", form.serial_no),
                ("Final Status", form.get_status_display()),
                ("Approved By", last_approver),
            ], color="#10b981", bg="#f0fdf4")}
            <p>The workflow is now complete. You can access the final filled report for your records below:</p>
            {_button(fill_url, "View Final Report", "#10b981")}
            {_link_fallback(fill_url)}
        """

        recipient_string = ";".join(participants)
        success = send_email_via_sendgrid(
            to_email=recipient_string, subject=subject,
            html_content=_wrap_html(body),
            reply_to=sender_email if sender_email else None,
        )
        if success:
            logger.info("Final summary email sent to %s (form %s)", recipient_string, form.serial_no)
        else:
            logger.warning("Final summary email failed for %s (form %s)", recipient_string, form.serial_no)
    except _EMAIL_ERRORS:
        logger.error("Final summary email failed for form %s", form.serial_no, exc_info=True)


# ─── Email: Reversal notification ────────────────────────────────────────────────

def send_reversal_email(form, link, next_email: str, sender_email: str, old_status: str, note: str):
    """Send a notification to the previous reviewer when a form is reverted."""
    try:
        subject = f"Payment Authorization - Reverted ({form.serial_no})"
        fill_url = f"{settings.FRONTEND_BASE_URL}/supplierForm/fill?token={link.token}"

        body = f"""
            <h2 style="color: #dc2626;">Report Reverted for Correction</h2>
            <p>Dear Reviewer,</p>
            <p>The Payment Authorization for <strong>{form.supplier_name}</strong> has been sent back to your section for correction by <strong>{sender_email}</strong>.</p>
            {_info_box([
                ("Reverted From", old_status),
                ("Reverted by", sender_email),
                ("Note from Reviewer", note),
            ], color="#ef4444", bg="#fff1f2")}
            <p>Please click the button below to access the form and complete your section:</p>
            {_button(fill_url, "Update Report", "#dc2626")}
            {_link_fallback(fill_url)}
        """

        success = send_email_via_sendgrid(
            to_email=next_email, subject=subject,
            html_content=_wrap_html(body), reply_to=sender_email,
        )
        if success:
            logger.info("Reverse email sent to %s for form %s", next_email, form.serial_no)
        else:
            logger.warning("Reverse email failed for %s (form %s)", next_email, form.serial_no)
    except _EMAIL_ERRORS:
        logger.error("Reverse email failed for form %s", form.serial_no, exc_info=True)
