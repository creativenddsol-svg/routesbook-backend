import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config(); // Load environment variables in dev
}

// ✅ Log key values for debug
console.log("✅ SENDGRID_API_KEY:", process.env.SENDGRID_API_KEY?.slice(0, 5));
console.log("✅ EMAIL_FROM:", process.env.EMAIL_FROM);

// ✅ Validate API Key
if (
  !process.env.SENDGRID_API_KEY ||
  !process.env.SENDGRID_API_KEY.startsWith("SG.")
) {
  console.error("❌ ERROR: Invalid or missing SendGrid API Key.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ✅ Send Email Utility
const sendEmail = async (to, subject, message) => {
  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #1e40af;">Routesbook</h2>
        <p style="color: #555;">Your trusted bus ticket partner</p>
      </div>

      <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        ${message}
      </div>

      <div style="text-align: center; font-size: 12px; color: #aaa; margin-top: 20px;">
        <p>Routesbook.lk — Reliable travel, every time.</p>
        <p>Please do not reply to this email.</p>
      </div>
    </div>
  `;

  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject,
    html: htmlTemplate,
  };

  try {
    await sgMail.send(msg);
    console.log("✅ SendGrid email sent to:", to);
  } catch (error) {
    console.error(
      "❌ SendGrid email failed:",
      error.response?.body || error.message
    );
  }
};

export default sendEmail;
