import nodemailer from 'nodemailer';

// ── Create Transporter ──
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    tls: { rejectUnauthorized: false },
  });
};

const FROM = process.env.EMAIL_FROM || 'SUOWMRS Notification <noreply@suowmrs.in>';

// ── Premium Modern Email Template Wrapper ──
const baseTemplate = ({ title, subtitle, badgeText = 'OFFICIAL NOTIFICATION', badgeColor = '#0EA5E9', content }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${title || 'SUOWMRS System Notification'}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0B1120;
      color: #E2E8F0;
      line-height: 1.6;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
      padding: 32px 16px;
    }
    .main-card {
      background: #0F172A;
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.5), 0 0 40px rgba(14, 165, 233, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0284C7 0%, #0F4C5C 50%, #0369A1 100%);
      padding: 36px 32px;
      text-align: center;
      position: relative;
    }
    .logo-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 14px;
      padding: 8px 16px;
      margin-bottom: 14px;
    }
    .logo-text {
      font-size: 19px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-family: 'Segoe UI', Roboto, sans-serif;
    }
    .logo-text span {
      color: #38BDF8;
    }
    .header-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #E0F2FE;
      background: rgba(14, 165, 233, 0.3);
      border: 1px solid rgba(125, 211, 252, 0.4);
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    .header p {
      font-size: 13px;
      color: rgba(224, 242, 254, 0.85);
      max-width: 480px;
      margin: 0 auto;
      line-height: 1.5;
    }
    .body {
      padding: 34px 32px 28px 32px;
      background: #0F172A;
    }
    .greeting {
      font-size: 16px;
      color: #F1F5F9;
      margin-bottom: 14px;
      font-weight: 600;
    }
    .message {
      font-size: 14px;
      color: #94A3B8;
      line-height: 1.7;
      margin-bottom: 22px;
    }
    .info-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 20px 0;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(56, 189, 248, 0.15);
      border-radius: 12px;
      overflow: hidden;
    }
    .info-table tr:not(:last-child) td {
      border-bottom: 1px solid rgba(56, 189, 248, 0.1);
    }
    .info-table td {
      padding: 12px 16px;
      font-size: 13px;
      color: #CBD5E1;
    }
    .info-table td:first-child {
      font-weight: 600;
      color: #7DD3FC;
      width: 40%;
      background: rgba(2, 132, 199, 0.05);
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #34D399; border: 1px solid rgba(52, 211, 153, 0.4); }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #FBBF24; border: 1px solid rgba(251, 191, 36, 0.4); }
    .badge-danger  { background: rgba(239, 68, 68, 0.2);  color: #F87171; border: 1px solid rgba(248, 113, 113, 0.4); }
    .badge-info    { background: rgba(14, 165, 233, 0.2); color: #38BDF8; border: 1px solid rgba(56, 189, 248, 0.4); }
    .badge-purple  { background: rgba(168, 85, 247, 0.2); color: #C084FC; border: 1px solid rgba(192, 132, 252, 0.4); }

    .btn {
      display: inline-block;
      padding: 14px 30px;
      background: linear-gradient(135deg, #0284C7 0%, #0284C7 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4);
      margin-top: 10px;
      text-align: center;
    }
    .btn-emerald {
      background: linear-gradient(135deg, #059669 0%, #10B981 100%);
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }
    .btn-danger {
      background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
    }
    .highlight-card {
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(2, 132, 199, 0.05) 100%);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 14px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    .alert-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      padding: 14px 18px;
      margin: 18px 0;
    }
    .alert-box p {
      color: #FCA5A5;
      font-size: 13px;
      margin: 0;
    }
    .security-note {
      font-size: 12px;
      color: #64748B;
      line-height: 1.6;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 16px;
      margin-top: 24px;
    }
    .footer {
      background: #090E17;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid rgba(56, 189, 248, 0.12);
    }
    .footer p {
      font-size: 12px;
      color: #475569;
      line-height: 1.7;
    }
    .footer a {
      color: #38BDF8;
      text-decoration: none;
    }
    .footer .links {
      margin-bottom: 10px;
    }
    .footer .links a {
      margin: 0 8px;
      font-size: 11px;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      <div class="header">
        <div class="logo-container">
          <span class="logo-text">💧 SUOW<span>MRS</span></span>
        </div>
        <br/>
        <div class="header-badge" style="background:${badgeColor}25; border-color:${badgeColor}60; color:#FFFFFF;">
          ${badgeText}
        </div>
        <h1>${title}</h1>
        <p>${subtitle || 'Smart Urban Overflow & Water Management & Reuse System'}</p>
      </div>

      <div class="body">
        ${content}
      </div>

      <div class="footer">
        <div class="links">
          <a href="#">Official Portal</a> •
          <a href="#">Security Center</a> •
          <a href="#">Help & Support</a>
        </div>
        <p>This is an automated system notification from the SUOWMRS Central Command Grid.<br/>
        Please do not reply directly to this email address.</p>
        <p style="margin-top:8px; font-size:11px; color:#334155;">
          © 2026 SUOWMRS • Municipal Water Grid Infrastructure • All Rights Reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ── Generic Send Function ──
export const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`✉️ Email successfully dispatched to ${to}: [${subject}] (ID: ${info?.messageId || 'ok'})`);
    return { success: true, messageId: info?.messageId };
  } catch (error) {
    console.error(`⚠️ Email dispatch failed to ${to}:`, error.message);
    // Don't crash if SMTP is unconfigured or credentials are in demo mode
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────
// 1. OTP Verification Email (Registration)
// ─────────────────────────────────────────────────────────────
export const sendOtpEmail = async ({ to, fullName, otp }) => {
  const content = `
    <div class="greeting">Hello ${fullName || 'Valued User'},</div>
    <div class="message">
      Thank you for registering on <strong>SUOWMRS</strong>. To verify your email address and activate your account access, please use the 6-digit one-time verification code below:
    </div>

    <div class="highlight-card">
      <div style="font-size:11px; font-weight:700; color:#7DD3FC; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;">
        One-Time Verification Code
      </div>
      <div style="font-size:38px; font-weight:900; color:#38BDF8; letter-spacing:10px; font-family: 'Courier New', monospace; text-shadow: 0 0 15px rgba(56,189,248,0.5);">
        ${otp}
      </div>
      <div style="font-size:12px; color:#94A3B8; margin-top:8px;">
        ⏱️ Code expires in <strong style="color:#F1F5F9;">10 minutes</strong>
      </div>
    </div>

    <div class="security-note">
      🔒 <strong>Security Warning:</strong> Never share this OTP with anyone, including SUOWMRS personnel or municipality staff. If you did not initiate this registration request, please ignore this email safely.
    </div>
  `;

  return sendEmail({
    to,
    subject: `🔐 Your SUOWMRS Verification Code: ${otp}`,
    html: baseTemplate({
      title: 'Verify Your Email Address',
      subtitle: 'Complete your registration on the Municipal Water Monitoring Portal',
      badgeText: 'IDENTITY VERIFICATION',
      badgeColor: '#0EA5E9',
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 2. Forgot Password / Password Reset Email
// ─────────────────────────────────────────────────────────────
export const sendPasswordResetEmail = async ({ to, fullName, resetOtp, resetLink }) => {
  const content = `
    <div class="greeting">Hello ${fullName || 'User'},</div>
    <div class="message">
      We received a request to reset the password for your <strong>SUOWMRS</strong> account. Use the secure authorization code below to configure a new password:
    </div>

    <div class="highlight-card" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%); border-color: rgba(245, 158, 11, 0.3);">
      <div style="font-size:11px; font-weight:700; color:#FBBF24; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;">
        Password Reset Code
      </div>
      <div style="font-size:38px; font-weight:900; color:#F59E0B; letter-spacing:10px; font-family: 'Courier New', monospace; text-shadow: 0 0 15px rgba(245,158,11,0.4);">
        ${resetOtp}
      </div>
      <div style="font-size:12px; color:#94A3B8; margin-top:8px;">
        ⏱️ This code is valid for <strong style="color:#F1F5F9;">15 minutes</strong>
      </div>
    </div>

    ${
      resetLink
        ? `<div style="text-align:center; margin:20px 0;">
             <a href="${resetLink}" class="btn" style="background:linear-gradient(135deg,#D97706,#F59E0B);">Reset Password Directly</a>
           </div>`
        : ''
    }

    <div class="security-note">
      ⚠️ <strong>Didn't request this?</strong> If you did not ask to reset your password, someone may have entered your email address by mistake. Your account remains secure and no changes have been made.
    </div>
  `;

  return sendEmail({
    to,
    subject: `🔑 Password Reset Code: ${resetOtp} | SUOWMRS`,
    html: baseTemplate({
      title: 'Reset Your Account Password',
      subtitle: 'Authorize secure password modification for your SUOWMRS profile',
      badgeText: 'SECURITY ALERT',
      badgeColor: '#F59E0B',
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 3. Password Reset Success Email
// ─────────────────────────────────────────────────────────────
export const sendPasswordResetSuccessEmail = async ({ to, fullName }) => {
  const content = `
    <div class="greeting">Hello ${fullName || 'User'},</div>
    <div class="message">
      This is a confirmation that the password for your <strong>SUOWMRS</strong> account has been successfully changed.
    </div>

    <table class="info-table">
      <tr>
        <td>Event</td>
        <td><span class="badge badge-success">Password Updated</span></td>
      </tr>
      <tr>
        <td>Timestamp</td>
        <td>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>Active & Protected</td>
      </tr>
    </table>

    <div class="security-note">
      🚨 <strong>Security Advisory:</strong> If you did not perform this password change, please contact system administration or email <a href="mailto:support@suowmrs.in" style="color:#38BDF8;">support@suowmrs.in</a> immediately to freeze your account.
    </div>
  `;

  return sendEmail({
    to,
    subject: `✅ Password Successfully Changed | SUOWMRS`,
    html: baseTemplate({
      title: 'Password Changed Successfully',
      subtitle: 'Your SUOWMRS security credentials have been updated',
      badgeText: 'SECURITY CONFIRMATION',
      badgeColor: '#10B981',
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 4. Account Verification Status Update (Approved / Rejected)
// ─────────────────────────────────────────────────────────────
export const sendAccountStatusEmail = async ({ to, fullName, role, status, reason, municipalityName }) => {
  const isApproved = status === 'Verified';
  const badgeClass = isApproved ? 'badge-success' : 'badge-danger';
  const badgeColor = isApproved ? '#10B981' : '#EF4444';

  const content = `
    <div class="greeting">Hello ${fullName || 'User'},</div>
    <div class="message">
      ${
        isApproved
          ? `Congratulations! Your <strong>SUOWMRS</strong> account application has been reviewed and <strong style="color:#34D399;">APPROVED</strong> by the municipality administration.`
          : `We regret to inform you that your <strong>SUOWMRS</strong> account application has been <strong style="color:#F87171;">REJECTED</strong> or suspended by the municipal administration.`
      }
    </div>

    <table class="info-table">
      <tr>
        <td>Full Name</td>
        <td><strong>${fullName}</strong></td>
      </tr>
      <tr>
        <td>Designated Role</td>
        <td><span class="badge badge-info">${role}</span></td>
      </tr>
      ${municipalityName ? `<tr><td>Municipality / Body</td><td>${municipalityName}</td></tr>` : ''}
      <tr>
        <td>Verification Status</td>
        <td><span class="badge ${badgeClass}">${status.toUpperCase()}</span></td>
      </tr>
      <tr>
        <td>Effective Date</td>
        <td>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
      </tr>
      ${reason ? `<tr><td>Remarks</td><td style="color:#F87171;">${reason}</td></tr>` : ''}
    </table>

    ${
      isApproved
        ? `<div style="text-align:center; margin:24px 0;">
             <a href="http://localhost:5173/login" class="btn btn-emerald">Sign In To Portal Now</a>
           </div>`
        : `<div class="alert-box"><p>If you believe this was an error, please reach out to your municipal node administrator or support team.</p></div>`
    }

    <div class="security-note">
      Official verification issued by SUOWMRS Urban Water Network Authority.
    </div>
  `;

  return sendEmail({
    to,
    subject: `${isApproved ? '✅ Account Approved' : '❌ Account Application Update'} | SUOWMRS`,
    html: baseTemplate({
      title: isApproved ? 'Account Approved & Verified' : 'Account Verification Status',
      subtitle: `Official notice regarding your access to the SUOWMRS Grid`,
      badgeText: isApproved ? 'ACCESS GRANTED' : 'ACTION NOTICE',
      badgeColor,
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 5. Municipality Admin / Role Assignment Update Email
// ─────────────────────────────────────────────────────────────
export const sendAdminRoleChangedEmail = async ({ to, fullName, newRole, municipalityName, designation, updatedBy }) => {
  const isAdmin = newRole === 'Admin';
  const content = `
    <div class="greeting">Hello ${fullName},</div>
    <div class="message">
      Your official account role and permissions in the <strong>SUOWMRS Central Command Grid</strong> have been updated by the system authority.
    </div>

    <table class="info-table">
      <tr>
        <td>Designated Authority Role</td>
        <td><span class="badge ${isAdmin ? 'badge-purple' : 'badge-info'}">${newRole}</span></td>
      </tr>
      ${municipalityName ? `<tr><td>Municipal Jurisdiction</td><td><strong style="color:#38BDF8;">${municipalityName}</strong></td></tr>` : ''}
      ${designation ? `<tr><td>Official Title / Designation</td><td>${designation}</td></tr>` : ''}
      <tr>
        <td>Granted Permissions</td>
        <td>${isAdmin ? 'Full Municipal Grid Administration, Node Overrides, System Approvals & Diverter Controls' : 'Standard Assigned Role Clearance'}</td>
      </tr>
      <tr>
        <td>Authorized By</td>
        <td>${updatedBy || 'Central Municipal Authority'}</td>
      </tr>
      <tr>
        <td>Effective From</td>
        <td>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)</td>
      </tr>
    </table>

    <div style="text-align:center; margin:24px 0;">
      <a href="http://localhost:5173/login" class="btn" style="background:linear-gradient(135deg, #7C3AED, #9333EA);">Access Admin Command Portal</a>
    </div>

    <div class="security-note">
      🛡️ <strong>Administrative Notice:</strong> Administrative actions within SUOWMRS are audited and logged according to national urban water safety compliance standards.
    </div>
  `;

  return sendEmail({
    to,
    subject: `🏛️ Role Update: You are assigned as ${newRole} (${municipalityName || 'SUOWMRS'})`,
    html: baseTemplate({
      title: 'Municipal Role & Authority Update',
      subtitle: 'Your administrative access rights have been reconfigured',
      badgeText: 'AUTHORITY ASSIGNMENT',
      badgeColor: '#A855F7',
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 6. Payment Success Email
// ─────────────────────────────────────────────────────────────
export const sendPaymentSuccessEmail = async ({ to, customerName, planLabel, amount, invoiceNumber, invoiceUrl, receiptUrl, nextDueDate }) => {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);
  const nextDue = nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

  const content = `
    <div class="greeting">Dear ${customerName},</div>
    <div class="message">
      We have received and confirmed your payment for SUOWMRS water infrastructure and maintenance services.
    </div>

    <table class="info-table">
      <tr><td>Invoice Number</td><td><strong>${invoiceNumber}</strong></td></tr>
      <tr><td>Service / Plan</td><td>${planLabel}</td></tr>
      <tr><td>Amount Paid</td><td><strong style="color:#34D399; font-size:15px;">${formattedAmount}</strong></td></tr>
      <tr><td>Payment Status</td><td><span class="badge badge-success">PAID & SETTLED</span></td></tr>
      <tr><td>Next Renewal Due</td><td>${nextDue}</td></tr>
      <tr><td>Transaction Date</td><td>${new Date().toLocaleString('en-IN')}</td></tr>
    </table>

    <div style="text-align:center; margin:20px 0;">
      ${invoiceUrl ? `<a class="btn" href="${invoiceUrl}" target="_blank" style="margin-right:8px;">📄 Download Invoice</a>` : ''}
      ${receiptUrl ? `<a class="btn btn-emerald" href="${receiptUrl}" target="_blank">🧾 View Payment Receipt</a>` : ''}
    </div>

    <div class="security-note">
      Thank you for supporting smart water recycling and sustainable urban drainage.
    </div>
  `;

  return sendEmail({
    to,
    subject: `✅ Payment Confirmed — ${planLabel} | SUOWMRS`,
    html: baseTemplate({
      title: 'Payment Received & Confirmed',
      subtitle: 'Your transaction was successfully processed',
      badgeText: 'PAYMENT RECEIPT',
      badgeColor: '#10B981',
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 7. Payment Failed Email
// ─────────────────────────────────────────────────────────────
export const sendPaymentFailedEmail = async ({ to, customerName, planLabel, amount, failureReason, retryUrl }) => {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);

  const content = `
    <div class="greeting">Dear ${customerName},</div>
    <div class="message">
      We were unable to process your payment for <strong>${planLabel}</strong>. Your automated flood monitoring sensors and protection remain active without interruption.
    </div>

    <div class="alert-box">
      <p>⚠️ <strong>Reason for Failure:</strong> ${failureReason || 'Card authorization declined by issuing bank.'}</p>
    </div>

    <table class="info-table">
      <tr><td>Service / Plan</td><td>${planLabel}</td></tr>
      <tr><td>Amount Due</td><td><strong style="color:#F87171;">${formattedAmount}</strong></td></tr>
      <tr><td>Payment Status</td><td><span class="badge badge-danger">FAILED</span></td></tr>
      <tr><td>Attempt Timestamp</td><td>${new Date().toLocaleString('en-IN')}</td></tr>
    </table>

    <div style="text-align:center; margin:22px 0;">
      ${retryUrl ? `<a class="btn btn-danger" href="${retryUrl}" target="_blank">🔄 Retry Payment Now</a>` : ''}
    </div>

    <div class="security-note">
      Please update your payment details or try an alternative UPI / Net Banking payment method to maintain continuous AMC service coverage.
    </div>
  `;

  return sendEmail({
    to,
    subject: `❌ Payment Failed: Action Required — ${planLabel} | SUOWMRS`,
    html: baseTemplate({
      title: 'Payment Processing Failed',
      subtitle: 'Immediate action required to renew your maintenance coverage',
      badgeText: 'PAYMENT ALERT',
      badgeColor: '#EF4444',
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 8. Subscription Activated Email
// ─────────────────────────────────────────────────────────────
export const sendSubscriptionActivatedEmail = async ({ to, customerName, plan, planLabel, amountPerCycle, billingCycle, periodEnd }) => {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amountPerCycle);
  const renewDate = periodEnd ? new Date(periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

  const content = `
    <div class="greeting">Dear ${customerName},</div>
    <div class="message">
      Your SUOWMRS Annual Maintenance Contract (AMC) subscription is officially <strong style="color:#34D399;">ACTIVE</strong>. Your drainage sensors and overflow equipment are covered under priority technical warranty.
    </div>

    <table class="info-table">
      <tr><td>Subscription Plan</td><td><strong>${planLabel}</strong></td></tr>
      <tr><td>Billing Cycle</td><td>${billingCycle.toUpperCase()}</td></tr>
      <tr><td>Rate per Period</td><td><strong style="color:#38BDF8;">${formattedAmount}</strong></td></tr>
      <tr><td>Coverage Status</td><td><span class="badge badge-success">ACTIVE & PROTECTED</span></td></tr>
      <tr><td>Next Renewal Date</td><td>${renewDate}</td></tr>
    </table>

    <div class="security-note">
      A certified SUOWMRS field technician will conduct regular bi-monthly sensor diagnostic inspections. You can track all scheduled visits from your dashboard.
    </div>
  `;

  return sendEmail({
    to,
    subject: `🎉 AMC Subscription Active — ${planLabel} | SUOWMRS`,
    html: baseTemplate({
      title: 'AMC Subscription Activated',
      subtitle: 'Comprehensive municipal water system protection is now active',
      badgeText: 'SERVICE ACTIVATED',
      badgeColor: '#10B981',
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 9. Invoice Delivery Email
// ─────────────────────────────────────────────────────────────
export const sendInvoiceEmail = async ({ to, customerName, invoiceNumber, planLabel, amount, invoiceUrl, paidDate }) => {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);
  const date = paidDate ? new Date(paidDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN');

  const content = `
    <div class="greeting">Dear ${customerName},</div>
    <div class="message">
      Please find attached your official GST Tax Invoice from <strong>SUOWMRS</strong> for municipal services and water system maintenance.
    </div>

    <table class="info-table">
      <tr><td>Tax Invoice No.</td><td><strong>${invoiceNumber}</strong></td></tr>
      <tr><td>Service Plan</td><td>${planLabel}</td></tr>
      <tr><td>Total Paid</td><td><strong style="color:#34D399;">${formattedAmount}</strong></td></tr>
      <tr><td>Payment Date</td><td>${date}</td></tr>
      <tr><td>Invoice Status</td><td><span class="badge badge-success">PAID</span></td></tr>
    </table>

    ${invoiceUrl ? `<div style="text-align:center; margin:22px 0;"><a class="btn" href="${invoiceUrl}" target="_blank">📄 Download Tax Invoice (PDF)</a></div>` : ''}

    <div class="security-note">
      This document serves as an official proof of payment for tax filing and accounting purposes.
    </div>
  `;

  return sendEmail({
    to,
    subject: `📄 Tax Invoice: ${invoiceNumber} | SUOWMRS`,
    html: baseTemplate({
      title: 'Tax Invoice & Receipt',
      subtitle: `Invoice #${invoiceNumber} for municipal drainage services`,
      badgeText: 'TAX INVOICE',
      badgeColor: '#0EA5E9',
      content,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 10. Service Team Notification Email
// ─────────────────────────────────────────────────────────────
export const sendServiceTeamNotification = async ({ customerName, planLabel, address, contactNumber, serviceType }) => {
  const teamEmail = process.env.SERVICE_TEAM_EMAIL || process.env.SMTP_USER;
  if (!teamEmail) return;

  const content = `
    <div class="greeting">Field Service Dispatch Team,</div>
    <div class="message">
      A new service work order has been generated following confirmed payment/subscription activation.
    </div>

    <table class="info-table">
      <tr><td>Customer Name</td><td><strong>${customerName}</strong></td></tr>
      <tr><td>Service / Plan</td><td><strong>${serviceType || planLabel}</strong></td></tr>
      <tr><td>Location / Ward</td><td>${address || 'Address registered on user profile'}</td></tr>
      <tr><td>Contact Number</td><td><strong style="color:#38BDF8;">${contactNumber || 'N/A'}</strong></td></tr>
      <tr><td>Dispatch Timestamp</td><td>${new Date().toLocaleString('en-IN')}</td></tr>
    </table>

    <div class="security-note">
      Please assign a certified technician within 24 hours via the SUOWMRS Technician Dispatch Console.
    </div>
  `;

  return sendEmail({
    to: teamEmail,
    subject: `🛠️ New Service Work Order: ${customerName} (${planLabel})`,
    html: baseTemplate({
      title: 'Field Service Dispatch Order',
      subtitle: 'Automated work order for on-site system inspection',
      badgeText: 'DISPATCH ALERT',
      badgeColor: '#F59E0B',
      content,
    }),
  });
};

