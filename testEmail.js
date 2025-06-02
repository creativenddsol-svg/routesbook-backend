// testEmail.js
import dotenv from "dotenv";
dotenv.config();

import sgMail from "@sendgrid/mail";

// Load and debug environment variables
console.log("SENDGRID_API_KEY:", process.env.SENDGRID_API_KEY?.slice(0, 5));
console.log("EMAIL_FROM:", process.env.EMAIL_FROM);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: "sdileepa98@gmail.com", // ✅ Your test email
  from: process.env.EMAIL_FROM, // ✅ Must match your verified sender
  subject: "SendGrid Test Email",
  html: "<strong>Hello from SendGrid test script!</strong>",
};

sgMail
  .send(msg)
  .then(() => {
    console.log("✅ Test email sent successfully!");
  })
  .catch((error) => {
    console.error("❌ Failed to send email:");
    console.error(error.response?.body || error.message);
  });
