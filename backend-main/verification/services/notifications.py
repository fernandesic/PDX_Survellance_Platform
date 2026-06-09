"""
Notifications for the verification feedback loop.

Wires ReviewTickets to PDX's existing channels, mirroring the pattern in
sentinel/agent_classifier.py:
  * Email via Django send_mail() to the ALERT_NOTIFY_EMAILS list.
  * Telegram via sentinel.telegram_bot._send_message() to ALERT_TELEGRAM_CHAT_ID.

Both channels degrade gracefully: if the relevant env var / token is not
configured, the send is skipped with a log line and the caller continues. This
matches how the rest of PDX behaves and keeps tests side-effect free.

Recipients (env, same names PDX already uses):
  ALERT_NOTIFY_EMAILS        comma-separated list, e.g. "a@who.int,b@who.int"
  ALERT_TELEGRAM_CHAT_ID     a single chat id
  VERIFICATION_NOTIFY_EMAILS optional override just for verification tickets
  VERIFICATION_TELEGRAM_CHAT_ID optional override
  FRONTEND_BASE_URL          used to build the dashboard deep-link
"""

import logging
import os
import smtplib

import requests

from django.conf import settings

logger = logging.getLogger(__name__)

# Failure modes for Django send_mail (SMTP backend) and the Telegram HTTP path.
# We swallow these at the notification boundary so a transient transport
# problem never breaks the ticket workflow.
_NOTIFY_ERRORS = (smtplib.SMTPException, requests.RequestException, OSError, ValueError)


def _notify_emails() -> list:
    raw = (os.getenv('VERIFICATION_NOTIFY_EMAILS', '').strip()
           or os.getenv('ALERT_NOTIFY_EMAILS', '').strip())
    return [e.strip() for e in raw.split(',') if e.strip()]


def _telegram_chat_id() -> str:
    return (os.getenv('VERIFICATION_TELEGRAM_CHAT_ID', '').strip()
            or os.getenv('ALERT_TELEGRAM_CHAT_ID', '').strip())


def _dashboard_link() -> str:
    base = getattr(settings, 'FRONTEND_BASE_URL', '') or os.getenv('FRONTEND_BASE_URL', '')
    return f"{base.rstrip('/')}/verification" if base else ''


def _compose(ticket) -> tuple:
    """Return (subject, plain_text, html) for a ReviewTicket."""
    reason = ticket.get_reason_display() if hasattr(ticket, 'get_reason_display') else ticket.reason
    subject = f"[PDX Verification] {ticket.title}"
    link = _dashboard_link()
    lines = [
        f"A prediction closed as: {reason}",
        f"Module:   {ticket.source_module}",
        f"Country:  {ticket.country_iso or '—'}",
        f"Disease:  {ticket.disease_name or '—'}",
        "",
        ticket.detail or "",
    ]
    if link:
        lines += ["", f"Review in dashboard: {link}"]
    text = "\n".join(lines)
    html = (
        f"<h3>{ticket.title}</h3>"
        f"<p><b>Outcome:</b> {reason}</p>"
        f"<ul>"
        f"<li><b>Module:</b> {ticket.source_module}</li>"
        f"<li><b>Country:</b> {ticket.country_iso or '—'}</li>"
        f"<li><b>Disease:</b> {ticket.disease_name or '—'}</li>"
        f"</ul>"
        f"<pre style='white-space:pre-wrap'>{ticket.detail or ''}</pre>"
        + (f"<p><a href='{link}'>Review in dashboard</a></p>" if link else "")
    )
    return subject, text, html


def send_email(ticket) -> bool:
    """Email a ticket to the configured recipients. Returns True if sent."""
    recipients = _notify_emails()
    if not recipients:
        logger.info('verification.notify: no email recipients configured; skipping email for ticket %s',
                    getattr(ticket, 'id', '?'))
        return False
    subject, text, _html = _compose(ticket)
    try:
        from django.core.mail import send_mail
        send_mail(
            subject=subject,
            message=text,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=recipients,
            fail_silently=False,
        )
        logger.info('verification.notify: emailed ticket %s to %d recipients',
                    getattr(ticket, 'id', '?'), len(recipients))
        return True
    except _NOTIFY_ERRORS as e:
        logger.error('verification.notify: email failed for ticket %s: %s',
                     getattr(ticket, 'id', '?'), e)
        return False


def send_telegram(ticket) -> bool:
    """Send a ticket summary to the configured Telegram chat. Returns True if sent."""
    chat_id = _telegram_chat_id()
    if not chat_id:
        logger.info('verification.notify: no telegram chat id configured; skipping telegram for ticket %s',
                    getattr(ticket, 'id', '?'))
        return False
    _subject, _text, html = _compose(ticket)
    try:
        from sentinel.telegram_bot import _send_message
        msg_id = _send_message(chat_id, html, parse_mode='HTML')
        ok = msg_id is not None
        logger.info('verification.notify: telegram ticket %s → %s',
                    getattr(ticket, 'id', '?'), 'sent' if ok else 'dropped')
        return ok
    except _NOTIFY_ERRORS as e:
        logger.error('verification.notify: telegram failed for ticket %s: %s',
                     getattr(ticket, 'id', '?'), e)
        return False


def notify_ticket(ticket) -> dict:
    """
    Fire all configured channels for a ticket. Never raises — notification
    failure must not break the feedback pipeline. Returns which channels fired.
    """
    result = {'email': False, 'telegram': False}
    try:
        result['email'] = send_email(ticket)
    except _NOTIFY_ERRORS as e:
        logger.error('verification.notify: unexpected email error: %s', e)
    try:
        result['telegram'] = send_telegram(ticket)
    except _NOTIFY_ERRORS as e:
        logger.error('verification.notify: unexpected telegram error: %s', e)
    return result
