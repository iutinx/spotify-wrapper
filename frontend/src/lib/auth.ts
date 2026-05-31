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

function ls(): Storage | null {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      return localStorage;
    }
  } catch {}
  return null;
}

export function storeTokens(tokens: TokenResponse): void {
  const store = ls();
  if (!store) return;
  store.setItem("access_token", tokens.access_token);
  store.setItem("refresh_token", tokens.refresh_token);
  store.setItem("token_expires_at", String(Date.now() + tokens.expires_in * 1000));
}

export function clearTokens(): void {
  const store = ls();
  if (!store) return;
  store.removeItem("access_token");
  store.removeItem("refresh_token");
  store.removeItem("token_expires_at");
}

export function getAccessToken(): string | null {
  return ls()?.getItem("access_token") ?? null;
}

export function getRefreshToken(): string | null {
  return ls()?.getItem("refresh_token") ?? null;
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