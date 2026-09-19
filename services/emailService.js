// ─────────────────────────────────────────────────────────────
// SUOWMRS Email Service — delivered over HTTPS via the Brevo API.
// (Hosts such as Render block outbound SMTP, so no SMTP transport here.)
// ─────────────────────────────────────────────────────────────

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const SENDER = {
  name: process.env.BREVO_SENDER_NAME || 'SUOWMRS',
  email: process.env.BREVO_SENDER_EMAIL || '',
};
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@suowmrs.in';

// ── Generic Send Function ──
export const sendEmail = async ({ to, subject, html }) => {
  try {
    if (!BREVO_API_KEY || !SENDER.email) {
      throw new Error('BREVO_API_KEY / BREVO_SENDER_EMAIL not configured');
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Brevo ${res.status}: ${data?.message || data?.code || 'request failed'}`);
    }

    console.log(`✉️ Email dispatched to ${to}: [${subject}] (ID: ${data?.messageId || 'ok'})`);
    return { success: true, messageId: data?.messageId };
  } catch (error) {
    console.error(`⚠️ Email dispatch failed to ${to}:`, error.message);
    // Don't crash callers — they decide how to surface the failure
    return { success: false, error: error.message };
  }
};

// ═════════════════════════════════════════════════════════════
// Layout — classic, light, table-based with inline styles so it
// renders consistently in Gmail, Outlook and mobile clients.
// ═════════════════════════════════════════════════════════════

const COLORS = {
  brand: '#0F4C5C',
  brandDark: '#0A333E',
  text: '#1E293B',
  muted: '#64748B',
  faint: '#94A3B8',
  border: '#E2E8F0',
  panel: '#F8FAFC',
  page: '#F1F5F9',
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  info: '#0369A1',
  purple: '#6D28D9',
};

const FONT_BODY = "Arial, Helvetica, 'Segoe UI', sans-serif";
const FONT_HEAD = "Georgia, 'Times New Roman', serif";
const FONT_MONO = "'Courier New', Courier, monospace";

// Escape user-supplied values before interpolating them into HTML
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const fmtINR = (paise) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

const fmtDate = (d = new Date()) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

const fmtDateTime = (d = new Date()) =>
  `${new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;

// ── Building blocks ──

const greeting = (name) =>
  `<p style="margin:0 0 14px; font-family:${FONT_BODY}; font-size:16px; color:${COLORS.text};">${esc(name)},</p>`;

const paragraph = (html) =>
  `<p style="margin:0 0 18px; font-family:${FONT_BODY}; font-size:15px; line-height:1.65; color:${COLORS.text};">${html}</p>`;

const codeBox = ({ label, code, note, color = COLORS.brand }) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0; border:1px solid ${COLORS.border}; border-radius:6px; background:${COLORS.panel};">
    <tr>
      <td align="center" style="padding:22px 16px;">
        <div style="font-family:${FONT_BODY}; font-size:11px; font-weight:bold; letter-spacing:2px; text-transform:uppercase; color:${COLORS.muted}; margin-bottom:10px;">${esc(label)}</div>
        <div style="font-family:${FONT_MONO}; font-size:36px; font-weight:bold; letter-spacing:12px; color:${color}; padding-left:12px;">${esc(code)}</div>
        ${note ? `<div style="font-family:${FONT_BODY}; font-size:12px; color:${COLORS.muted}; margin-top:10px;">${note}</div>` : ''}
      </td>
    </tr>
  </table>`;

// rows: [[label, valueHtml], ...] — falsy rows are skipped
const details = (rows) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px; border:1px solid ${COLORS.border}; border-radius:6px; border-collapse:separate; overflow:hidden;">
    ${rows.filter(Boolean).map(([label, value], i, arr) => `
    <tr>
      <td style="padding:11px 16px; width:40%; font-family:${FONT_BODY}; font-size:12px; font-weight:bold; letter-spacing:0.5px; text-transform:uppercase; color:${COLORS.muted}; background:${COLORS.panel}; border-bottom:${i < arr.length - 1 ? `1px solid ${COLORS.border}` : 'none'}; vertical-align:top;">${esc(label)}</td>
      <td style="padding:11px 16px; font-family:${FONT_BODY}; font-size:14px; color:${COLORS.text}; border-bottom:${i < arr.length - 1 ? `1px solid ${COLORS.border}` : 'none'}; vertical-align:top;">${value}</td>
    </tr>`).join('')}
  </table>`;

const badge = (text, color = COLORS.info) =>
  `<span style="display:inline-block; padding:3px 10px; border:1px solid ${color}; border-radius:3px; font-family:${FONT_BODY}; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:${color};">${esc(text)}</span>`;

const strong = (text, color = COLORS.text) =>
  `<strong style="color:${color};">${esc(text)}</strong>`;

const button = (text, href, color = COLORS.brand) => `
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto 24px;">
    <tr>
      <td align="center" bgcolor="${color}" style="border-radius:4px;">
        <a href="${esc(href)}" target="_blank" style="display:inline-block; padding:13px 30px; font-family:${FONT_BODY}; font-size:14px; font-weight:bold; color:#FFFFFF; text-decoration:none; border-radius:4px;">${esc(text)}</a>
      </td>
    </tr>
  </table>`;

const buttons = (...items) => {
  const visible = items.filter(Boolean);
  if (!visible.length) return '';
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto 24px;">
    <tr>
      ${visible.map(([text, href, color = COLORS.brand]) => `
      <td align="center" bgcolor="${color}" style="border-radius:4px;">
        <a href="${esc(href)}" target="_blank" style="display:inline-block; padding:13px 24px; font-family:${FONT_BODY}; font-size:14px; font-weight:bold; color:#FFFFFF; text-decoration:none; border-radius:4px;">${esc(text)}</a>
      </td>`).join('<td style="width:12px; font-size:0;">&nbsp;</td>')}
    </tr>
  </table>`;
};

const alertBox = (html, color = COLORS.danger, bg = '#FEF2F2') => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
    <tr>
      <td style="padding:14px 16px; background:${bg}; border-left:4px solid ${color}; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:${COLORS.text};">${html}</td>
    </tr>
  </table>`;

const note = (html) =>
  `<p style="margin:22px 0 0; padding-top:16px; border-top:1px solid ${COLORS.border}; font-family:${FONT_BODY}; font-size:12px; line-height:1.65; color:${COLORS.muted};">${html}</p>`;

// ── Page wrapper ──
const layout = ({ title, eyebrow, accent = COLORS.brand, content }) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${esc(title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background:${COLORS.page}; -webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#FFFFFF; border:1px solid ${COLORS.border}; border-radius:8px; border-collapse:separate; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:${COLORS.brand}; padding:26px 36px; text-align:center;">
              <div style="font-family:${FONT_HEAD}; font-size:26px; letter-spacing:4px; color:#FFFFFF;">SUOWMRS</div>
              <div style="font-family:${FONT_BODY}; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#B6DDE5; margin-top:6px;">Smart Urban Overflow &amp; Water Management System</div>
            </td>
          </tr>
          <tr><td style="height:4px; background:${accent}; font-size:0; line-height:0;">&nbsp;</td></tr>

          <!-- Title -->
          <tr>
            <td style="padding:32px 36px 8px;">
              ${eyebrow ? `<div style="font-family:${FONT_BODY}; font-size:11px; font-weight:bold; letter-spacing:2px; text-transform:uppercase; color:${accent}; margin-bottom:8px;">${esc(eyebrow)}</div>` : ''}
              <h1 style="margin:0; font-family:${FONT_HEAD}; font-size:24px; font-weight:normal; line-height:1.3; color:${COLORS.text};">${esc(title)}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:16px 36px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px; background:${COLORS.panel}; border-top:1px solid ${COLORS.border}; text-align:center;">
              <p style="margin:0 0 6px; font-family:${FONT_BODY}; font-size:12px; line-height:1.6; color:${COLORS.muted};">
                This is an automated message from SUOWMRS. Please do not reply to this email.<br/>
                Need help? Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLORS.brand}; text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:0; font-family:${FONT_BODY}; font-size:11px; color:${COLORS.faint};">
                &copy; ${new Date().getFullYear()} SUOWMRS &middot; Municipal Water Infrastructure &middot; All rights reserved.
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

// ═════════════════════════════════════════════════════════════
// 1. OTP Verification Email (Registration)
// ═════════════════════════════════════════════════════════════
export const sendOtpEmail = async ({ to, fullName, otp }) => {
  const content = `
    ${greeting(`Hello ${fullName || 'there'}`)}
    ${paragraph('Thank you for registering with <strong>SUOWMRS</strong>. Please use the verification code below to confirm your email address and continue with your registration.')}
    ${codeBox({ label: 'Verification code', code: otp, note: 'This code expires in <strong>10 minutes</strong>.' })}
    ${note('<strong>Security notice:</strong> Never share this code with anyone. SUOWMRS staff will never ask for it. If you did not start this registration, you can safely ignore this email.')}
  `;

  return sendEmail({
    to,
    subject: `Your SUOWMRS verification code: ${otp}`,
    html: layout({ title: 'Verify your email address', eyebrow: 'Email verification', content }),
  });
};

// ═════════════════════════════════════════════════════════════
// 2. Password Reset Email
// ═════════════════════════════════════════════════════════════
export const sendPasswordResetEmail = async ({ to, fullName, resetOtp, resetLink }) => {
  const content = `
    ${greeting(`Hello ${fullName || 'there'}`)}
    ${paragraph('We received a request to reset the password for your <strong>SUOWMRS</strong> account. Enter the code below to set a new password.')}
    ${codeBox({ label: 'Password reset code', code: resetOtp, note: 'This code is valid for <strong>15 minutes</strong>.', color: COLORS.warning })}
    ${resetLink ? button('Reset password', resetLink, COLORS.warning) : ''}
    ${note("<strong>Didn't request this?</strong> Someone may have entered your email address by mistake. Your account is still secure and no changes have been made.")}
  `;

  return sendEmail({
    to,
    subject: `Password reset code: ${resetOtp} — SUOWMRS`,
    html: layout({ title: 'Reset your password', eyebrow: 'Account security', accent: COLORS.warning, content }),
  });
};

// ═════════════════════════════════════════════════════════════
// 3. Password Reset Success Email
// ═════════════════════════════════════════════════════════════
export const sendPasswordResetSuccessEmail = async ({ to, fullName }) => {
  const content = `
    ${greeting(`Hello ${fullName || 'there'}`)}
    ${paragraph('This confirms that the password for your <strong>SUOWMRS</strong> account was changed successfully.')}
    ${details([
      ['Event', badge('Password updated', COLORS.success)],
      ['Date & time', esc(fmtDateTime())],
      ['Account status', 'Active'],
    ])}
    ${button('Sign in to SUOWMRS', `${CLIENT_URL}/login`)}
    ${note(`<strong>Wasn't you?</strong> If you did not change your password, contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLORS.brand};">${SUPPORT_EMAIL}</a> immediately so we can secure your account.`)}
  `;

  return sendEmail({
    to,
    subject: 'Your password was changed — SUOWMRS',
    html: layout({ title: 'Password changed successfully', eyebrow: 'Account security', accent: COLORS.success, content }),
  });
};

// ═════════════════════════════════════════════════════════════
// 4. Account Verification Status Update (Approved / Rejected)
// ═════════════════════════════════════════════════════════════
export const sendAccountStatusEmail = async ({ to, fullName, role, status, reason, municipalityName }) => {
  const isApproved = status === 'Verified';
  const accent = isApproved ? COLORS.success : COLORS.danger;

  const content = `
    ${greeting(`Hello ${fullName || 'there'}`)}
    ${paragraph(isApproved
      ? `Good news — your <strong>SUOWMRS</strong> account has been reviewed and ${strong('approved', COLORS.success)} by the municipal administration. You can now sign in and access the portal.`
      : `Your <strong>SUOWMRS</strong> account application has been reviewed and was ${strong('not approved', COLORS.danger)} by the municipal administration.`)}
    ${details([
      ['Full name', strong(fullName)],
      ['Role', badge(role)],
      municipalityName && ['Municipality', esc(municipalityName)],
      ['Status', badge(status, accent)],
      ['Effective date', esc(fmtDate())],
      reason && ['Remarks', `<span style="color:${COLORS.danger};">${esc(reason)}</span>`],
    ])}
    ${isApproved
      ? button('Sign in to SUOWMRS', `${CLIENT_URL}/login`, COLORS.success)
      : alertBox('If you believe this decision was made in error, please contact your municipal administrator or our support team.')}
    ${note('Verification notice issued by the SUOWMRS municipal administration.')}
  `;

  return sendEmail({
    to,
    subject: isApproved ? 'Your SUOWMRS account has been approved' : 'Update on your SUOWMRS account application',
    html: layout({
      title: isApproved ? 'Your account has been approved' : 'Account verification update',
      eyebrow: 'Account verification',
      accent,
      content,
    }),
  });
};

// ═════════════════════════════════════════════════════════════
// 5. Municipality Admin / Role Assignment Update Email
// ═════════════════════════════════════════════════════════════
export const sendAdminRoleChangedEmail = async ({ to, fullName, newRole, municipalityName, designation, updatedBy }) => {
  const isAdmin = newRole === 'Admin';

  const content = `
    ${greeting(`Hello ${fullName || 'there'}`)}
    ${paragraph('Your role and permissions on <strong>SUOWMRS</strong> have been updated by the system administration. The details of your new assignment are below.')}
    ${details([
      ['New role', badge(newRole, isAdmin ? COLORS.purple : COLORS.info)],
      municipalityName && ['Municipality', strong(municipalityName, COLORS.brand)],
      designation && ['Designation', esc(designation)],
      ['Permissions', isAdmin
        ? 'Full municipal administration: user approvals, system overrides, alerts and diverter controls'
        : 'Standard permissions for the assigned role'],
      ['Updated by', esc(updatedBy || 'Central Municipal Authority')],
      ['Effective from', esc(fmtDateTime())],
    ])}
    ${button(isAdmin ? 'Open the admin portal' : 'Sign in to SUOWMRS', `${CLIENT_URL}/login`, isAdmin ? COLORS.purple : COLORS.brand)}
    ${note('Administrative actions in SUOWMRS are logged and audited in line with municipal water-safety compliance requirements.')}
  `;

  return sendEmail({
    to,
    subject: `Your role has been updated to ${newRole} — ${municipalityName || 'SUOWMRS'}`,
    html: layout({ title: 'Your role has been updated', eyebrow: 'Role assignment', accent: isAdmin ? COLORS.purple : COLORS.info, content }),
  });
};

// ═════════════════════════════════════════════════════════════
// 6. Payment Success Email
// ═════════════════════════════════════════════════════════════
export const sendPaymentSuccessEmail = async ({ to, customerName, planLabel, amount, invoiceNumber, invoiceUrl, receiptUrl, nextDueDate }) => {
  const content = `
    ${greeting(`Dear ${customerName || 'Customer'}`)}
    ${paragraph('We have received your payment for SUOWMRS water infrastructure and maintenance services. Thank you.')}
    ${details([
      ['Invoice number', strong(invoiceNumber)],
      ['Service / plan', esc(planLabel)],
      ['Amount paid', strong(fmtINR(amount), COLORS.success)],
      ['Status', badge('Paid', COLORS.success)],
      ['Next renewal', nextDueDate ? esc(fmtDate(nextDueDate)) : 'N/A'],
      ['Transaction date', esc(fmtDateTime())],
    ])}
    ${buttons(
      invoiceUrl && ['Download invoice', invoiceUrl],
      receiptUrl && ['View receipt', receiptUrl, COLORS.success],
    )}
    ${note('Thank you for supporting smart water recycling and sustainable urban drainage.')}
  `;

  return sendEmail({
    to,
    subject: `Payment confirmed — ${planLabel} — SUOWMRS`,
    html: layout({ title: 'Payment received', eyebrow: 'Payment receipt', accent: COLORS.success, content }),
  });
};

// ═════════════════════════════════════════════════════════════
// 7. Payment Failed Email
// ═════════════════════════════════════════════════════════════
export const sendPaymentFailedEmail = async ({ to, customerName, planLabel, amount, failureReason, retryUrl }) => {
  const content = `
    ${greeting(`Dear ${customerName || 'Customer'}`)}
    ${paragraph(`We were unable to process your payment for <strong>${esc(planLabel)}</strong>. Your flood-monitoring sensors and protection remain active for now.`)}
    ${alertBox(`<strong>Reason:</strong> ${esc(failureReason || 'Card authorisation declined by the issuing bank.')}`)}
    ${details([
      ['Service / plan', esc(planLabel)],
      ['Amount due', strong(fmtINR(amount), COLORS.danger)],
      ['Status', badge('Failed', COLORS.danger)],
      ['Attempted on', esc(fmtDateTime())],
    ])}
    ${retryUrl ? button('Retry payment', retryUrl, COLORS.danger) : ''}
    ${note('Please update your payment details or try an alternative method (UPI / net banking) to keep your maintenance coverage uninterrupted.')}
  `;

  return sendEmail({
    to,
    subject: `Payment failed — action required — ${planLabel} — SUOWMRS`,
    html: layout({ title: 'Payment could not be processed', eyebrow: 'Payment alert', accent: COLORS.danger, content }),
  });
};

// ═════════════════════════════════════════════════════════════
// 8. Subscription Activated Email
// ═════════════════════════════════════════════════════════════
export const sendSubscriptionActivatedEmail = async ({ to, customerName, plan, planLabel, amountPerCycle, billingCycle, periodEnd }) => {
  const rate = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amountPerCycle);

  const content = `
    ${greeting(`Dear ${customerName || 'Customer'}`)}
    ${paragraph(`Your SUOWMRS Annual Maintenance Contract (AMC) subscription is now ${strong('active', COLORS.success)}. Your drainage sensors and overflow equipment are covered under priority technical support.`)}
    ${details([
      ['Plan', strong(planLabel)],
      ['Billing cycle', esc(String(billingCycle || '').toUpperCase())],
      ['Rate per period', strong(rate, COLORS.brand)],
      ['Coverage', badge('Active', COLORS.success)],
      ['Next renewal', periodEnd ? esc(fmtDate(periodEnd)) : 'N/A'],
    ])}
    ${button('View your dashboard', `${CLIENT_URL}/login`, COLORS.success)}
    ${note('A certified SUOWMRS technician will carry out regular sensor diagnostic inspections. Scheduled visits can be tracked from your dashboard.')}
  `;

  return sendEmail({
    to,
    subject: `AMC subscription activated — ${planLabel} — SUOWMRS`,
    html: layout({ title: 'Your AMC subscription is active', eyebrow: 'Subscription', accent: COLORS.success, content }),
  });
};

// ═════════════════════════════════════════════════════════════
// 9. Invoice Delivery Email
// ═════════════════════════════════════════════════════════════
export const sendInvoiceEmail = async ({ to, customerName, invoiceNumber, planLabel, amount, invoiceUrl, paidDate }) => {
  const content = `
    ${greeting(`Dear ${customerName || 'Customer'}`)}
    ${paragraph('Your official GST tax invoice from <strong>SUOWMRS</strong> for municipal services and water-system maintenance is ready.')}
    ${details([
      ['Invoice number', strong(invoiceNumber)],
      ['Service / plan', esc(planLabel)],
      ['Total paid', strong(fmtINR(amount), COLORS.success)],
      ['Payment date', esc(fmtDate(paidDate || new Date()))],
      ['Status', badge('Paid', COLORS.success)],
    ])}
    ${invoiceUrl ? button('Download tax invoice (PDF)', invoiceUrl) : ''}
    ${note('This document serves as official proof of payment for tax filing and accounting purposes.')}
  `;

  return sendEmail({
    to,
    subject: `Tax invoice ${invoiceNumber} — SUOWMRS`,
    html: layout({ title: `Tax invoice ${invoiceNumber}`, eyebrow: 'Invoice', content }),
  });
};

// ═════════════════════════════════════════════════════════════
// 10. Service Team Notification Email
// ═════════════════════════════════════════════════════════════
export const sendServiceTeamNotification = async ({ customerName, planLabel, address, contactNumber, serviceType }) => {
  const teamEmail = process.env.SERVICE_TEAM_EMAIL || SENDER.email;
  if (!teamEmail) return;

  const content = `
    ${greeting('Field service team')}
    ${paragraph('A new service work order has been generated following a confirmed payment / subscription activation.')}
    ${details([
      ['Customer', strong(customerName)],
      ['Service / plan', strong(serviceType || planLabel)],
      ['Location / ward', esc(address || 'Address registered on the user profile')],
      ['Contact number', strong(contactNumber || 'N/A', COLORS.brand)],
      ['Generated on', esc(fmtDateTime())],
    ])}
    ${button('Open dispatch console', `${CLIENT_URL}/login`, COLORS.warning)}
    ${note('Please assign a certified technician within 24 hours via the SUOWMRS technician dispatch console.')}
  `;

  return sendEmail({
    to: teamEmail,
    subject: `New service work order: ${customerName} (${planLabel})`,
    html: layout({ title: 'New field service work order', eyebrow: 'Dispatch', accent: COLORS.warning, content }),
  });
};
