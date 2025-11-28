import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

const API_BASE_URL = "http://localhost:3001/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));

  // Set axios default header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      verifyToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`);
      setUser(response.data.user);
    } catch (error) {
      // Token không hợp lệ hoặc đã hết hạn
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      if (response.data.requireOtp) {
        return {
          requireOtp: true,
          tempToken: response.data.tempToken,
          message: response.data.message,
        };
      }

      const { token: newToken, user: userData } = response.data;
      localStorage.setItem("token", newToken);
      setToken(newToken);
      setUser(userData);
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Đăng nhập thất bại",
      };
    }
  };

  const verifyOtp = async (otp, tempToken) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        otp,
        tempToken,
      });
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem("token", newToken);
      setToken(newToken);
      setUser(userData);
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Xác thực OTP thất bại",
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        name,
        email,
        password,
      });

      const { token: newToken, user: userData } = response.data;
      localStorage.setItem("token", newToken);
      setToken(newToken);
      setUser(userData);
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Đăng ký thất bại",
      };
    }
  };

  const loginWithGoogle = async (token) => {
    try {
      localStorage.setItem("token", token);
      setToken(token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      await verifyToken();
      return { success: true };
    } catch (error) {
      return { success: false, error: "Google login failed" };
    }
  };

  const updateSettings = async (settings) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/users/settings`, {
        settings,
      });
      setUser((prev) => ({ ...prev, settings: response.data.settings }));
      return { success: true };
    } catch (error) {
      return { success: false, error: "Lỗi cập nhật cài đặt" };
    }
  };

  const enable2FA = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/2fa/enable`);
      setUser((prev) => ({
        ...prev,
        twoFactor: { ...prev.twoFactor, enabled: true },
      }));
      return { success: true, message: response.data.message };
    } catch (error) {
      return { success: false, error: "Lỗi bật 2FA" };
    }
  };

  const confirm2FA = async (otp) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/2fa/confirm`, {
        otp,
      });
      setUser((prev) => ({
        ...prev,
        twoFactor: { ...prev.twoFactor, enabled: true },
      }));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Mã OTP không đúng",
      };
    }
  };

  const disable2FA = async (password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/2fa/disable`, {
        password,
      });
      setUser((prev) => ({
        ...prev,
        twoFactor: { ...prev.twoFactor, enabled: false },
      }));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Mật khẩu không đúng",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  };

  const value = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    verifyOtp,
    updateSettings,
    enable2FA,
    confirm2FA,
    disable2FA,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
