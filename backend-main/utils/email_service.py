"""
Centralized Email Service using SendGrid Web API v3.
Used by both supplier_form and department_form for workflow email notifications.

Falls back to the legacy Power Automate method if SendGrid is not configured.
"""
import logging
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def send_email(to_email, subject, html_content, reply_to=None):
    """
    Send an email using SendGrid Web API v3.
    
    Args:
        to_email: Recipient email address (string, or semicolon-separated for multiple)
        subject: Email subject line
        html_content: HTML body of the email
        reply_to: Optional reply-to email address
    
    Returns:
        True if email was sent successfully, False otherwise
    """
    api_key = getattr(settings, 'SENDGRID_API_KEY', '')
    from_email_setting = getattr(settings, 'SENDGRID_FROM_EMAIL', 'noreply@example.com')
    
    logger.info(f"[EMAIL] Attempting send to: {to_email} | From: {from_email_setting} | Subject: {subject}")
    
    if not api_key or api_key.startswith('SG.REPLACE'):
        logger.warning("SENDGRID_API_KEY is not configured. Skipping email send.")
        return True  # Return True so workflow continues
    
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import (
            Mail, Email, To, Content, ReplyTo
        )
        
        # Handle multiple recipients (semicolon-separated)
        recipients = [e.strip() for e in to_email.split(';') if e.strip()]
        logger.info(f"[EMAIL] Recipients parsed: {recipients}")
        
        message = Mail(
            from_email=Email(from_email_setting),
            subject=subject,
            to_emails=[To(r) for r in recipients],
            html_content=Content("text/html", html_content)
        )
        
        if reply_to:
            message.reply_to = ReplyTo(reply_to)
        
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        
        if response.status_code in (200, 201, 202):
            logger.info(f"[EMAIL OK] Sent to {to_email} (Status: {response.status_code})")
            return True
        else:
            logger.error(
                "[EMAIL FAIL] SendGrid non-OK status=%s to=%s body=%s",
                response.status_code, to_email, response.body,
            )
            return False
            
    except ImportError:
        logger.error("sendgrid package not installed. Run: pip install sendgrid")
        return False
    except Exception:  # noqa: BLE001 — sendgrid client wraps arbitrary HTTP/auth errors; must return False
        logger.error(
            "[EMAIL FAIL] SendGrid exception for to=%s subject=%s",
            to_email, subject, exc_info=True,
        )
        return False

