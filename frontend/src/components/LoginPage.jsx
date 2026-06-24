import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

export function LoginPage() {
  const { login, continueAsGuest } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await login(username, password, rememberMe);
    } catch (err) {
      console.error("Login failed:", err);
      // Backend error message or generic invalidCredentials translation
      setError(err.message || t("login.invalidCredentials"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAsGuest = () => {
    setError("");
    setIsSubmitting(false);
    continueAsGuest();
  };

  return (
    <div className="login-viewport">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-brand">{t("login.brand")}</h1>
          <p className="login-subtitle">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label" htmlFor="username">
              {t("login.username")}
            </label>
            <input
              id="username"
              type="text"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="password">
              {t("login.password")}
            </label>
            <div className="login-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
              >
                {showPassword ? t("login.hidePassword") : t("login.showPassword")}
              </button>
            </div>
          </div>

          <div className="login-options">
            <label className="login-checkbox-label">
              <input
                type="checkbox"
                className="login-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isSubmitting}
              />
              {t("login.rememberMe")}
            </label>
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="login-actions">
            <button
              type="submit"
              className="login-btn login-btn-primary"
              disabled={isSubmitting || !username.trim() || !password}
            >
              {isSubmitting ? t("login.signingIn") : t("login.loginButton")}
            </button>

            <button
              type="button"
              className="login-btn login-btn-secondary"
              onClick={handleContinueAsGuest}
            >
              {t("login.guestButton")}
            </button>
          </div>
        </form>

        <div className="login-lang-selector">
          <button
            type="button"
            className={`login-lang-btn ${language === "en" ? "active" : ""}`}
            onClick={() => setLanguage("en")}
          >
            English
          </button>
          <span className="login-lang-divider">|</span>
          <button
            type="button"
            className={`login-lang-btn ${language === "th" ? "active" : ""}`}
            onClick={() => setLanguage("th")}
          >
            ไทย
          </button>
        </div>
      </div>
    </div>
  );
}
