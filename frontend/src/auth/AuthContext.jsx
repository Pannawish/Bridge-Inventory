// React component for authentication and authorization: auth context.

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
        // Refresh the access token in whichever store holds the refresh token, so
        // a session-only login never leaves an orphan token in localStorage.
        const usingLocal = Boolean(localStorage.getItem("inventory_refresh_token"));
        const refreshToken =
          localStorage.getItem("inventory_refresh_token") ||
          sessionStorage.getItem("inventory_refresh_token");
        if (refreshToken) {
          const res = await api.refreshToken(refreshToken);
          const store = usingLocal ? localStorage : sessionStorage;
          store.setItem("inventory_access_token", res.access);
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
      // No session to restore — drop any orphan access token so it can't shadow
      // a fresh token on the next sign-in (the "token not valid" first-try bug).
      localStorage.removeItem("inventory_access_token");
      sessionStorage.removeItem("inventory_access_token");
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

      // Clear tokens from BOTH stores first. request() reads localStorage before
      // sessionStorage, so a leftover token in the other store would shadow the
      // fresh one and make getMe() send a stale token → "token not valid" on the
      // first sign-in. Writing only to the chosen store keeps exactly one token.
      localStorage.removeItem("inventory_access_token");
      localStorage.removeItem("inventory_refresh_token");
      sessionStorage.removeItem("inventory_access_token");
      sessionStorage.removeItem("inventory_refresh_token");

      const store = rememberMe ? localStorage : sessionStorage;
      store.setItem("inventory_refresh_token", refresh);
      store.setItem("inventory_access_token", access);

      // Fetch profile
      const userData = await api.getMe();
      setUser(userData);
      setIsGuest(false);
      sessionStorage.removeItem("inventory_is_guest");

      startTokenRefreshInterval();
      window.location.reload();
      return userData;
    } catch (error) {
      clearAuth();
      throw error;
    }
  };

  const logout = () => {
    clearAuth();
    window.location.reload();
  };

  const continueAsGuest = () => {
    clearAuth();
    setIsGuest(true);
    sessionStorage.setItem("inventory_is_guest", "true");
    window.location.reload();
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
