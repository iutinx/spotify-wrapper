"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ShaderBackground } from "@/components/landing/shader-background";
import { WaveformBg } from "@/components/landing/waveform-bg";
import { CustomCursor } from "@/components/landing/custom-cursor";
import "./dashboard.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "2px solid #ececec",
            borderTopColor: "#0a0a0a",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const tabs = [
    { label: "Dashboard", href: "/analytics" },
    { label: "Discover", href: "/discover" },
    { label: "Friends", href: "/social" },
    { label: "Settings", href: "/settings" },
  ];

  return (
    <div className="resonance-dashboard">
      <ShaderBackground />
      <WaveformBg />
      <CustomCursor />

      <div className="db-shell">
        <nav className="db-nav">
          <Link href="/analytics" className="db-brand">
            <div className="db-brand-mark" />
            <span>Resonance</span>
          </Link>

          <div className="db-nav-tabs">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={pathname === tab.href || pathname?.startsWith(tab.href + "/") ? "active" : ""}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <div className="db-nav-right">
            <span className="db-lbl" style={{ color: "var(--db-ink-faint)" }}>
              connected
            </span>
            <div className="db-nav-avatar">
              {user?.profile_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profile_image_url} alt={user.display_name || "avatar"} />
              )}
            </div>
          </div>
        </nav>

        {children}
      </div>
    </div>
  );
}
