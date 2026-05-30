"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ShaderBackground } from "@/components/landing/shader-background";
import { CustomCursor } from "@/components/landing/custom-cursor";
import { WaveformBg } from "@/components/landing/waveform-bg";
import { WaveformCard } from "@/components/landing/waveform-card";
import "./login.css";

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/analytics");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="resonance-login">
        <ShaderBackground />
        <div className="app">
          <main className="auth-wrap">
            <section className="card" style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="resonance-login">
      <ShaderBackground />
      <CustomCursor />
      <WaveformBg />

      <div className="app">
        <header className="topbar">
          <Link href="/" className="brand">
            <div className="brand-mark" />
            <span>Resonance</span>
          </Link>
          <Link href="/" className="back">
            <span className="arrow">←</span> Back home
          </Link>
        </header>

        <main className="auth-wrap">
          <section className="card">
            <div className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Spotify_Full_Logo_RGB_Black.png" alt="Spotify" />
            </div>

            <div className="eyebrow">Welcome back</div>
            <h1>
              The shape of <em>your</em> sound.
            </h1>
            <p className="sub">
              Sign in to discover your listening patterns and connect with
              friends.
            </p>

            <WaveformCard />

            <button className="btn btn-primary" onClick={login}>
              <span className="ic" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/Spotify_Primary_Logo_RGB_Green.png" alt="" />
              </span>
              Continue with Spotify
            </button>

            <p className="disclaimer">
              By continuing, you agree to let us access your Spotify listening
              data. We only use it to provide you with personalized analytics.
            </p>
          </section>
        </main>

        <div className="meta">
          <span>© Resonance 2026</span>
          
          <span>v0.4.2 · build 1142</span>
        </div>
      </div>
    </div>
  );
}
