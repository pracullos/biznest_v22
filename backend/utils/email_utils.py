import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "") or SMTP_USER
SMTP_ENABLED = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def send_lgu_invite_email(to_email: str, magic_link: str, expires_hours: int = 24) -> None:
    if not SMTP_ENABLED:
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "You've been invited to BizNest as an LGU Administrator"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    html = f"""
    <html>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2>LGU Administrator Invitation</h2>
      <p>You have been invited to register as an LGU Administrator on <strong>BizNest</strong>.</p>
      <p>Click the button below to complete your registration.
         This link expires in <strong>{expires_hours} hour(s)</strong>.</p>
      <p style="margin: 32px 0;">
        <a href="{magic_link}"
           style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Complete Registration
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;">
        Or copy this link: {magic_link}
      </p>
      <p style="color:#6b7280;font-size:12px;">
        If you did not expect this invitation, you can safely ignore this email.
      </p>
    </body>
    </html>
    """
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())