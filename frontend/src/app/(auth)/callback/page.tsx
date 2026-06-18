"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseTokensFromUrl, cleanUrl, storeTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { ShaderBackground } from "@/components/landing/shader-background";
import "../login/login.css";

export default function CallbackPage() {
  const router = useRouter();
  const { refreshToken } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const tokens = parseTokensFromUrl();

      if (tokens) {
        storeTokens(tokens);
        cleanUrl();

        try {
          await refreshToken();
        } catch (e) {
          console.error("Token refresh failed:", e);
        }
      }

      router.push("/analytics");
    };

    handleCallback();
  }, [router, refreshToken]);

  return (
    <div className="resonance-login">
      <ShaderBackground />
      <div className="app">
        <main className="auth-wrap">
          <section className="card" style={{ minHeight: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "3px solid rgba(10,10,10,0.12)",
                borderTopColor: "#0a0a0a",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <div style={{ textAlign: "center" }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Connecting</div>
              <p className="sub" style={{ margin: 0, maxWidth: 280 }}>
                Please wait while we log you in.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}