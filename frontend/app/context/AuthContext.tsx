"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User } from "../types";
import {
  getStoredToken,
  setStoredToken,
  removeStoredToken,
  loginUserApi,
  fetchCurrentUserApi,
} from "../api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasPermission: (permissionId: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "pulsedesk_current_user_v1";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from storage & verify with backend on initial load
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const storedToken = getStoredToken();
        const storedUserJson = localStorage.getItem(USER_STORAGE_KEY);

        if (!storedToken) {
          if (isMounted) {
            setUser(null);
            setToken(null);
            setIsLoading(false);
          }
          return;
        }

        setToken(storedToken);

        // Pre-populate user from localStorage for instant feedback
        if (storedUserJson) {
          try {
            setUser(JSON.parse(storedUserJson));
          } catch {
            // ignore JSON parse error
          }
        }

        // Validate session and retrieve fresh profile + permissions from backend
        const freshUser = await fetchCurrentUserApi();
        if (isMounted) {
          if (freshUser && freshUser.isActive !== false) {
            setUser(freshUser);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
          } else {
            // Token is invalid, expired, or user deactivated
            removeStoredToken();
            setUser(null);
            setToken(null);
          }
        }
      } catch {
        if (isMounted) {
          removeStoredToken();
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await loginUserApi(email, password);
      if (res.success && res.token && res.user) {
        setStoredToken(res.token);
        setToken(res.token);
        setUser(res.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
        return { success: true };
      }
      return { success: false, message: res.message || "Invalid credentials." };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    removeStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await fetchCurrentUserApi();
    if (fresh) {
      setUser(fresh);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
    }
  }, []);

  const hasPermission = useCallback(
    (permissionId: string): boolean => {
      if (!user) return false;
      // Admin users have full universal access to all features
      if (user.role === "ADMIN") return true;

      // Check if permission is in user's granted permissions list
      if (Array.isArray(user.permissions)) {
        return user.permissions.includes(permissionId);
      }

      return false;
    },
    [user]
  );

  const isAuthenticated = Boolean(user && token);
  const isAdmin = user?.role === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
