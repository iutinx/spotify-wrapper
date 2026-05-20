import type { TokenResponse, User } from "@/types";

const SPOTIFY_LOGIN_URL = "https://127.0.0.1:5000/api/auth/spotify-login";
const CALLBACK_URL = "http://localhost:3000/callback";

export function getLoginUrl(): string {
  const redirectUri = encodeURIComponent(CALLBACK_URL);
  return `${SPOTIFY_LOGIN_URL}?redirect_uri=${redirectUri}`;
}

export function parseTokensFromUrl(): TokenResponse | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.substring(1);
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = params.get("expires_in");

  if (!accessToken || !refreshToken) return null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: parseInt(expiresIn || "1800", 10),
  };
}

export function storeTokens(tokens: TokenResponse): void {
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
  localStorage.setItem("token_expires_at", String(Date.now() + tokens.expires_in * 1000));
}

export function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("token_expires_at");
}

export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  return !!token;
}

export function cleanUrl(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function logout(): void {
  clearTokens();
  window.location.href = "/login";
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch("https://127.0.0.1:5000/api/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}