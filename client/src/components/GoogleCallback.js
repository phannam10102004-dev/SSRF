import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      loginWithGoogle(token).then(() => {
        navigate("/");
      });
    } else {
      navigate("/login");
    }
  }, [searchParams, loginWithGoogle, navigate]);

  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Đang xử lý đăng nhập Google...</p>
    </div>
  );
}

export default GoogleCallback;
