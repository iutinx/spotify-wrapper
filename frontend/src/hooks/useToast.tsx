"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastTone = "ok" | "error" | "info";

interface ToastState {
  text: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string, tone: ToastTone = "ok") => {
    setCurrent({ text, tone });
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2200);
  }, []);

  const dotColor = current?.tone === "error" ? "#b5462f" : "#1db954";

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          left: "50%",
          bottom: 30,
          transform: `translateX(-50%) translateY(${show ? 0 : 8}px)`,
          background: "#0a0a0a",
          color: "#ffffff",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 500,
          padding: "10px 18px",
          borderRadius: 999,
          boxShadow: "0 16px 36px -12px rgba(0,0,0,0.4)",
          opacity: show ? 1 : 0,
          transition: "opacity .25s, transform .25s",
          zIndex: 1000,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {current?.tone !== "info" && (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: dotColor,
              display: "inline-block",
              flex: "0 0 auto",
            }}
          />
        )}
        {current?.text}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // graceful no-op if used outside a provider
    return { toast: () => {} };
  }
  return ctx;
}
