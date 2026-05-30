"use client";

import Link from "next/link";
import { ShaderBackground } from "@/components/landing/shader-background";
import { WaveformCard } from "@/components/landing/waveform-card";
import { CustomCursor } from "@/components/landing/custom-cursor";
import "./landing.css";

export default function HomePage() {
  return (
    <div className="resonance">
      <ShaderBackground />
      <CustomCursor />

      <div className="app">
        <nav className="nav">
          <div className="brand">
            <div className="brand-mark" />
            <span>Resonance</span>
          </div>
          <div className="nav-links">
            <Link href="#">Features</Link>
            <Link href="#">Library</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/login" className="nav-cta">
              Get started
            </Link>
          </div>
        </nav>

        <main className="stage">
          <div className="eyebrow">Your listening, decoded</div>
          <h1 className="headline">
            The shape of <em>your</em> sound.
          </h1>
          <p className="subhead">
            A quiet, intelligent dashboard for the music you already love. Hover
            the wave - it listens back.
          </p>

          <WaveformCard />

          <div className="ctas">
            <Link href="/login" className="btn btn-primary">
              Connect your library <span className="arrow">→</span>
            </Link>
          </div>
        </main>

        <div className="meta">
          <span>© Resonance 2026</span>
          <span>v0.4.2 · build 1142</span>
        </div>
      </div>
    </div>
  );
}
