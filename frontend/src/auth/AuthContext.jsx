import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(() => {
    return sessionStorage.getItem("inventory_is_guest") === "true";
  });
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const clearAuth = () => {
    setUser(null);
    setIsGuest(false);
    sessionStorage.removeItem("inventory_is_guest");
    localStorage.removeItem("inventory_refresh_token");
    sessionStorage.removeItem("inventory_refresh_token");
    localStorage.removeItem("inventory_access_token");
    sessionStorage.removeItem("inventory_access_token");
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
  };

  const startTokenRefreshInterval = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    // Refresh access token every 15 minutes to keep it fresh
    refreshTimerRef.current = setInterval(async () => {
      try {
        const refreshToken =
          localStorage.getItem("inventory_refresh_token") ||
          sessionStorage.getItem("inventory_refresh_token");
        if (refreshToken) {
          const res = await api.refreshToken(refreshToken);
          const access = res.access;
          localStorage.setItem("inventory_access_token", access);
          sessionStorage.setItem("inventory_access_token", access);
        }
      } catch (err) {
        console.error("Background auto token refresh failed:", err);
        clearAuth();
      }
    }, 15 * 60 * 1000);
  };

  const initializeAuth = async () => {
    const refreshToken =
      localStorage.getItem("inventory_refresh_token") ||
      sessionStorage.getItem("inventory_refresh_token");

    if (isGuest) {
      setLoading(false);
      return;
    }

    if (!refreshToken) {
      setLoading(false);
      return;
    }

    try {
      // First refresh to get a fresh access token
      const res = await api.refreshToken(refreshToken);
      const access = res.access;
      localStorage.setItem("inventory_access_token", access);
      sessionStorage.setItem("inventory_access_token", access);

      // Fetch user profile
      const userData = await api.getMe();
      setUser(userData);
      startTokenRefreshInterval();
    } catch (error) {
      console.error("Initialization authentication failed:", error);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  // Handle auth-expired event dispatched by api.js
  useEffect(() => {
    const handleAuthExpired = () => {
      clearAuth();
    };

    window.addEventListener("auth-expired", handleAuthExpired);
    initializeAuth();

    return () => {
      window.removeEventListener("auth-expired", handleAuthExpired);
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  const login = async (username, password, rememberMe) => {
    try {
      const authData = await api.login(username, password);
      const { access, refresh } = authData;

      if (rememberMe) {
        localStorage.setItem("inventory_refresh_token", refresh);
        localStorage.setItem("inventory_access_token", access);
      } else {
        sessionStorage.setItem("inventory_refresh_token", refresh);
        sessionStorage.setItem("inventory_access_token", access);
      }

      // Fetch profile
      const userData = await api.getMe();
      setUser(userData);
      setIsGuest(false);
      sessionStorage.removeItem("inventory_is_guest");

      startTokenRefreshInterval();
      return userData;
    } catch (error) {
      clearAuth();
      throw error;
    }
  };

  const logout = () => {
    clearAuth();
  };

  const continueAsGuest = () => {
    clearAuth();
    setIsGuest(true);
    sessionStorage.setItem("inventory_is_guest", "true");
  };

  const value = {
    user,
    isGuest,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    continueAsGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
