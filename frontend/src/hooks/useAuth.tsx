"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User, TokenResponse } from "@/types";
import * as authLib from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    authLib.logout();
    setUser(null);
  }, []);

  const refreshToken = useCallback(async () => {
    const refreshToken = authLib.getRefreshToken();
    if (!refreshToken) {
      logout();
      return;
    }

    try {
      const response = await fetch("https://127.0.0.1:5000/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        logout();
        return;
      }

      const tokens: TokenResponse = await response.json();
      authLib.storeTokens(tokens);
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    const initAuth = async () => {
      const tokens = authLib.parseTokensFromUrl();
      if (tokens) {
        authLib.storeTokens(tokens);
        authLib.cleanUrl();
      }

      if (authLib.isAuthenticated()) {
        const currentUser = await authLib.fetchCurrentUser();
        setUser(currentUser);
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login: () => {
          window.location.href = authLib.getLoginUrl();
        },
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}