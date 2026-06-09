"""
Department Form — Email Templates & Dispatch

All email HTML templates for the department form workflow.
Uses Power Automate (currently disabled as a no-op stub).
"""

import logging
import smtplib
import threading

import requests
from django.conf import settings

from .reviewers import department_reviewer

logger = logging.getLogger(__name__)

# Failure modes for the Power Automate HTTP path + any SMTP fallback. The
# helpers re-raise RuntimeError on a non-2xx response, so the tuple
# includes it. Workflow code may re-raise after logging.
_EMAIL_ERRORS = (
    requests.RequestException,
    smtplib.SMTPException,
    OSError,
    RuntimeError,
    ValueError,
)


def _send_via_power_automate(to_email, subject, html_content, reply_to=None):
    """
    Placeholder: Power Automate email sending disabled per user request.
    Always returns True so the workflow progresses without sending an email.
    """
    logger.debug("Workflow Automate DISABLED. Would have sent email to: %s", to_email)
    return True


# ─── Shared HTML helpers (same style as supplier_form) ───────────────────────────

def _wrap_html(body_content: str) -> str:
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


def _button(url, text, color="#2563eb"):
    return f'<a href="{url}" style="display: inline-block; padding: 12px 24px; background: {color}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">{text}</a>'


def _link_fallback(url):
    return f'<p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">If the button above doesn\'t work, copy and paste this link into your browser:<br>{url}</p>'


def _info_box(items, color="#3b82f6", bg="#f8fafc"):
    lines = "".join(
        f'<p style="margin: {"0" if i == 0 else "4px 0 0"}; font-size: 14px;"><strong>{k}:</strong> {v}</p>'
        for i, (k, v) in enumerate(items)
    )
    return f'<div style="margin: 24px 0; padding: 16px; background: {bg}; border-left: 4px solid {color};">{lines}</div>'


# ─── Email: Initial form created ────────────────────────────────────────────────

def send_initial_email_async(form, recipient_email: str):
    """Send initial review email in a background thread."""

    def _send():
        try:
            department_display = form.department_name or "a department"
            token = form.access_link.token
            fill_url = f"{settings.FRONTEND_BASE_URL}/departmentForm/fill?token={token}"

            subject = f"Payment Authorization - New Review Required ({form.serial_no})"
            body = f"""
                <h2 style="color: #2563eb;">Payment Authorization</h2>
                <p>Dear Reviewer,</p>
                <p>A Payment Authorization for <strong>{department_display}</strong> has been initiated and requires your review.</p>
                {_info_box([
                    ("Serial No", form.serial_no),
                    ("Section", "A - Contract Compliance"),
                    ("Initiated by", recipient_email),
                ])}
                <p>Please click the button below to access the form and complete your section:</p>
                {_button(fill_url, "Start Review")}
                {_link_fallback(fill_url)}
            """

            success = _send_via_power_automate(
                to_email=recipient_email, subject=subject, html_content=_wrap_html(body),
            )
            if success:
                logger.info("Initial email sent to %s for form %s", recipient_email, form.serial_no)
            else:
                logger.warning("Failed to send initial email to %s for form %s", recipient_email, form.serial_no)
        except _EMAIL_ERRORS:
            logger.error("Initial email background thread failed for form %s", form.serial_no, exc_info=True)

    threading.Thread(target=_send, daemon=True).start()


# ─── Email: Section notification ─────────────────────────────────────────────────

def send_section_notification(form, link, next_email, sender_email, workflow_decision, is_backwards):
    """Send notification to the next reviewer after section submission."""
    try:
        if is_backwards:
            subject = f"Payment Authorization - Clarification Required ({form.serial_no})"
            color, header = "#dc2626", "Clarification Required / Form Reverted"
            action, btn = "Review and Correct", "Open Form"
        else:
            subject = f"Payment Authorization - Action Required ({form.serial_no})"
            color, header = "#2563eb", "Action Required: Review Submission"
            action, btn = "submitted for your review", "Review Report"

        fill_url = f"{settings.FRONTEND_BASE_URL}/departmentForm/fill?token={link.token}"

        body = f"""
            <h2 style="color: {color};">{header}</h2>
            <p>Dear Reviewer,</p>
            <p>A Payment Authorization for <strong>{form.department_name}</strong> has been {action} by <strong>{sender_email}</strong>.</p>
            {_info_box([
                ("Serial No", form.serial_no),
                ("Current Status", form.get_status_display()),
                ("Action Taken", workflow_decision or "Submitted"),
                ("Last Actor", sender_email),
            ], color=color)}
            <p>Please click the button below to access the form and take the necessary action:</p>
            {_button(fill_url, btn, color)}
            {_link_fallback(fill_url)}
        """

        success = _send_via_power_automate(
            to_email=next_email, subject=subject, html_content=_wrap_html(body), reply_to=sender_email,
        )
        if success:
            logger.info("Email sent to %s for form %s", next_email, form.serial_no)
        else:
            logger.warning("Email failed for %s (form %s)", next_email, form.serial_no)
            raise RuntimeError("Power Automate request failed")
    except _EMAIL_ERRORS:
        logger.error("Email notification failed for %s (form %s)", next_email, form.serial_no, exc_info=True)
        raise  # Re-raise so the view can return the "form saved but email failed" response


# ─── Email: Completion ───────────────────────────────────────────────────────────

def send_completion_email(form, link, sender_email):
    """Send summary email to all participants when the form is completed."""
    try:
        raw_participants = [
            form.initiator_email, form.section_1_email,
            form.section_2_email, form.section_3_email,
            form.supervisor_email, department_reviewer('D'),
        ]
        participants = []
        for p in raw_participants:
            if p and p not in participants:
                participants.append(p)

        if not participants:
            return

        fill_url = f"{settings.FRONTEND_BASE_URL}/departmentForm/fill?token={link.token}"
        department_display = form.department_name or "the Supplier"
        subject = f"Payment Authorization Approved ({form.serial_no})"

        reviewers_in_copy = ", ".join([p for p in participants if p != form.initiator_email])

        body = f"""
            <h2 style="color: #10b981;">Form Approved &amp; Completed</h2>
            <p>Dear Team,</p>
            <p>The Payment Authorization for <strong>{department_display}</strong> has been fully reviewed and approved.</p>
            {_info_box([
                ("Serial No", form.serial_no),
                ("Final Status", form.get_status_display()),
                ("Reviewers in Copy", reviewers_in_copy),
            ], color="#10b981", bg="#f0fdf4")}
            <p>The workflow is now complete. You can access the final filled report for your records below:</p>
            {_button(fill_url, "View Final Report", "#10b981")}
            {_link_fallback(fill_url)}
        """

        to_email = [form.initiator_email] if form.initiator_email else [participants[0]]
        cc_emails = [p for p in participants if p not in to_email]
        recipient_string = ";".join(to_email + cc_emails)

        success = _send_via_power_automate(
            to_email=recipient_string, subject=subject,
            html_content=_wrap_html(body),
            reply_to=sender_email if sender_email else None,
        )
        if success:
            logger.info("Final summary email sent for form %s", form.serial_no)
        else:
            raise RuntimeError("Power Automate request failed for final notification")
    except _EMAIL_ERRORS:
        logger.error("Final summary email failed for form %s", form.serial_no, exc_info=True)


# ─── Email: Reversal ─────────────────────────────────────────────────────────────

def send_reversal_email(form, link, next_email, sender_email, old_status, note):
    """Send reversal notification to the previous reviewer."""
    try:
        subject = f"Payment Authorization - Reverted ({form.serial_no})"
        fill_url = f"{settings.FRONTEND_BASE_URL}/departmentForm/fill?token={link.token}"

        body = f"""
            <h2 style="color: #dc2626;">Report Reverted for Correction</h2>
            <p>Dear Reviewer,</p>
            <p>The Payment Authorization for <strong>{form.department_name}</strong> has been sent back to your section for correction by <strong>{sender_email}</strong>.</p>
            {_info_box([
                ("Reverted From", old_status),
                ("Reverted by", sender_email),
                ("Note from Reviewer", note),
            ], color="#ef4444", bg="#fff1f2")}
            <p>Please click the button below to access the form and complete your section:</p>
            {_button(fill_url, "Update Report", "#dc2626")}
            {_link_fallback(fill_url)}
        """

        success = _send_via_power_automate(
            to_email=next_email, subject=subject,
            html_content=_wrap_html(body), reply_to=sender_email,
        )
        if success:
            logger.info("Reverse email sent to %s for form %s", next_email, form.serial_no)
        else:
            raise RuntimeError("Power Automate request failed for reversal")
    except _EMAIL_ERRORS:
        logger.error("Reverse email failed for form %s", form.serial_no, exc_info=True)
