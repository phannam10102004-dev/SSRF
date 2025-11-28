const nodemailer = require("nodemailer");

// Support both naming conventions
const getUser = () => process.env.MAIL_USER || process.env.EMAIL_USER;
const getPass = () => process.env.MAIL_PASS || process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: getUser(),
    pass: getPass(),
  },
});

/**
 * gửi otp
 */
const sendOTP = async (email, otp) => {
  try {
    const user = getUser();
    const pass = getPass();
    
    console.log("DEBUG EMAIL:", {
      userEnv: user ? "Set" : "Missing",
      passEnv: pass ? "Set" : "Missing",
      userVal: user, // Temporary log to check value
    });

    if (!user || !pass) {
      console.log("⚠️ No mail credentials provided. Logging OTP to console:");
      console.log(`To: ${email}`);
      console.log(`OTP: ${otp}`);
      return true;
    }

    await transporter.sendMail({
      from: `"My App" <${user}>`,
      to: email,
      subject: "Your OTP code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Mã xác thực của bạn</h2>
          <p>Xin chào,</p>
          <p>Bạn đang cố gắng đăng nhập vào tài khoản của mình. Vui lòng sử dụng mã OTP dưới đây để hoàn tất:</p>
          <div style="background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="letter-spacing: 5px; color: #1F2937; margin: 0;">${otp}</h1>
          </div>
          <p>Mã này sẽ hết hạn sau 5 phút.</p>
          <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        </div>
      `,
    });
    console.log(`✅ OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending OTP:", error);
    return false;
  }
};

// Keep sendEmail for backward compatibility if needed, but sendOTP is the main one used
const sendEmail = async (to, subject, html) => {
  try {
    const user = getUser();
    if (!user || !getPass()) {
      console.log("⚠️ No mail credentials provided. Logging email to console:");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      return true;
    }

    await transporter.sendMail({
      from: `"My App" <${user}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
};

module.exports = { sendOTP, sendEmail };
