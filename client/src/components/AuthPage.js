import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "./AuthPage.css";

import { EyeIcon, EyeOffIcon } from "./Icons";
import { getBackendUrl } from "../util";

function AuthPage() {
  const { login, register, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // 'login' or 'register'
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [otp, setOtp] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let result;
      if (mode === "login") {
        result = await login(formData.email, formData.password);
        if (result.requireOtp) {
          setShowOtpInput(true);
          setTempToken(result.tempToken);
          setError("");
        } else if (!result.success) {
          setError(result.error);
        } else {
          navigate("/");
        }
      } else {
        result = await register(
          formData.name,
          formData.email,
          formData.password
        );
        if (!result.success) {
          setError(result.error);
        } else {
          navigate("/");
        }
      }
    } catch (err) {
      setError("Đã có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await verifyOtp(otp, tempToken);
      if (result.success) {
        navigate("/");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Lỗi xác thực OTP");
    } finally {
      setLoading(false);
    }
  };

  if (showOtpInput) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-logo">🔒</div>
            <h2>Xác thực 2 lớp</h2>
            <p>Nhập mã OTP đã được gửi đến email của bạn</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleOtpSubmit} className="auth-form">
            <div className="form-group">
              <input
                type="text"
                className="form-input"
                placeholder="Nhập mã OTP (6 số)"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
                autoFocus
                style={{ textAlign: "center", letterSpacing: "5px", fontSize: "20px" }}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Đang xác thực..." : "Xác nhận"}
            </button>

            <button
              type="button"
              className="google-btn"
              onClick={() => {
                setShowOtpInput(false);
                setOtp("");
                setError("");
              }}
              style={{ marginTop: "10px", justifyContent: "center" }}
            >
              Quay lại đăng nhập
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">🔗</div>
          <h2>Social Network</h2>
          <p>Kết nối và chia sẻ với mọi người</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Đăng nhập
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <div className="form-group">
              <input
                type="text"
                className="form-input"
                placeholder="Tên hiển thị"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
          )}

          <div className="form-group">
            <input
              type="email"
              className="form-input"
              placeholder="Email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          <div className="form-group password-group">
            <input
              type={showPassword ? "text" : "password"}
              className="form-input"
              placeholder="Mật khẩu"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              minLength={6}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading
              ? "Đang xử lý..."
              : mode === "login"
              ? "Đăng nhập"
              : "Tạo tài khoản"}
          </button>
        </form>

        <div className="auth-divider">
          <span>hoặc</span>
        </div>

        <button
          className="google-btn"
          onClick={() => {
            window.location.href = `${getBackendUrl()}/api/auth/google`;
          }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
          />
          Tiếp tục với Google
        </button>
      </div>
    </div>
  );
}

export default AuthPage;
