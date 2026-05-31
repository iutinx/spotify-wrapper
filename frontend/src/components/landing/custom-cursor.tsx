"use client";

// Custom blob + ring cursor with mix-blend-mode: difference so it reads on any
// color. The dot tracks the pointer 1:1; the ring smooth-follows and expands
// over interactive elements. Ported from the cursor logic in the prototype's
// wave.js.

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.left = mouseX + "px";
        dotRef.current.style.top = mouseY + "px";
      }
    };
    window.addEventListener("mousemove", onMouseMove);

    // ring expands while hovering interactive elements inside the landing
    const enter = () => ringRef.current?.classList.add("hover");
    const leave = () => ringRef.current?.classList.remove("hover");
    const hoverEls = document.querySelectorAll(
      ".resonance button, .resonance a, .resonance-login button, .resonance-login a, .resonance-dashboard button, .resonance-dashboard a",
    );
    hoverEls.forEach((el) => {
      el.addEventListener("mouseenter", enter);
      el.addEventListener("mouseleave", leave);
    });

    let rafId = 0;
    const loop = () => {
      // smooth-follow so the ring trails the dot with a touch of inertia
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.left = ringX + "px";
        ringRef.current.style.top = ringY + "px";
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      hoverEls.forEach((el) => {
        el.removeEventListener("mouseenter", enter);
        el.removeEventListener("mouseleave", leave);
      });
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor" aria-hidden="true" />
      <div ref={ringRef} className="cursor ring" aria-hidden="true" />
    </>
  );
}
