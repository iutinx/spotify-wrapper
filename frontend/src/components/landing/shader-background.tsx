"use client";

// WebGL shader wallpaper — white background, procedural dot grid that warps
// around the cursor with click-driven ripple shockwaves. Ported from the
// design prototype's shader-bg.js into a self-contained React client component.

import { useEffect, useRef } from "react";

// up to 8 simultaneous click ripples; each is (x, y, startTime, intensity)
const MAX_RIPPLES = 8;
// dot grid spacing in CSS px (the prototype's default tweak value)
const DOT_GAP = 28;
// how long a ripple lives, in seconds
const RIPPLE_LIFE = 2.4;

interface Ripple {
  x: number;
  y: number;
  t: number;
  intensity: number;
}

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      // WebGL unavailable — leave the plain white background in place
      console.warn("WebGL not available — shader background disabled");
      return;
    }

    // ── shaders ──────────────────────────────────────────────────────────
    const vs = `
      attribute vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;

    const fs = `
      precision highp float;
      uniform vec2  u_res;
      uniform vec2  u_mouse;       // px, top-left origin
      uniform float u_time;        // seconds
      uniform float u_dotGap;      // px
      uniform vec4  u_ripples[${MAX_RIPPLES}]; // xy=px center, z=startTime, w=intensity

      // hash for tiny per-cell grain
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 px = gl_FragCoord.xy;
        // origin at top-left to match CSS
        vec2 p = vec2(px.x, u_res.y - px.y);

        // ── warp the sampling position before computing the dot grid ───────
        // 1) soft pull toward / push from cursor (very subtle, falls off fast)
        vec2 toMouse = p - u_mouse;
        float md = length(toMouse);
        float cursorFalloff = exp(-md / 130.0);
        // outward push so dots "make room" around the cursor — feels tactile
        vec2 warp = (toMouse / max(md, 0.001)) * cursorFalloff * 8.0;

        // 2) click ripples — expanding ring of outward displacement
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 r = u_ripples[i];
          if (r.w <= 0.0) continue;
          float age = u_time - r.z;
          if (age < 0.0 || age > 2.4) continue;
          vec2 toR = p - r.xy;
          float d = length(toR);
          float speed = 380.0;            // px / sec ripple velocity
          float ringR = age * speed;
          float thickness = 80.0;
          // gaussian ring profile
          float band = exp(-pow((d - ringR) / thickness, 2.0));
          float decay = (1.0 - age / 2.4);
          decay = decay * decay;
          warp += (toR / max(d, 0.001)) * band * decay * 22.0 * r.w;
        }

        vec2 q = p + warp;

        // ── procedural dot grid ────────────────────────────────────────────
        float g = u_dotGap;
        vec2 cell = mod(q, g) - g * 0.5;
        float dist = length(cell);
        float dotR = 1.2;                 // px
        float aa = 0.9;                   // anti-alias band
        float dotMask = 1.0 - smoothstep(dotR - aa, dotR + aa, dist);

        // dots gently brighten + grow near cursor (the cursor pools light)
        float halo = exp(-md / 220.0);
        float dotIntensity = dotMask * (0.18 + halo * 0.55);

        // per-cell idle shimmer using cell id
        vec2 cellId = floor(q / g);
        float shimmer = hash(cellId) * 0.06 + 0.5;
        float t = sin(u_time * 0.6 + shimmer * 12.0) * 0.5 + 0.5;
        dotIntensity *= 0.85 + t * 0.18;

        // background: vignette from pure white to a hair off-white at edges
        vec2 uv = px / u_res;
        vec2 cuv = uv - 0.5;
        float vig = 1.0 - dot(cuv, cuv) * 0.35;

        vec3 bg = vec3(1.0) * vig;
        // dots are dark grey; multiplied so they sit on the warm white
        vec3 col = mix(bg, vec3(0.0), dotIntensity);

        // click ripples also leave a faint glow trail at the ring crest
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 r = u_ripples[i];
          if (r.w <= 0.0) continue;
          float age = u_time - r.z;
          if (age < 0.0 || age > 2.4) continue;
          vec2 toR = p - r.xy;
          float d = length(toR);
          float ringR = age * 380.0;
          float thickness = 60.0;
          float band = exp(-pow((d - ringR) / thickness, 2.0));
          float decay = pow(1.0 - age / 2.4, 2.0);
          col -= band * decay * 0.04 * r.w;   // subtle darkening pulse
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    function compile(type: number, src: string): WebGLShader | null {
      const sh = gl!.createShader(type);
      if (!sh) return null;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        console.error("shader compile error", gl!.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    const vShader = compile(gl.VERTEX_SHADER, vs);
    const fShader = compile(gl.FRAGMENT_SHADER, fs);
    if (!vShader || !fShader) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("program link error", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uDotGap = gl.getUniformLocation(prog, "u_dotGap");
    const uRipples: (WebGLUniformLocation | null)[] = [];
    for (let i = 0; i < MAX_RIPPLES; i++) {
      uRipples.push(gl.getUniformLocation(prog, `u_ripples[${i}]`));
    }

    // ── state ──────────────────────────────────────────────────────────────
    let mouseX = -9999;
    let mouseY = -9999;
    let smoothedMouseX = mouseX;
    let smoothedMouseY = mouseY;
    const ripples: Ripple[] = [];

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const ratio = dpr();
      canvas!.width = Math.floor(window.innerWidth * ratio);
      canvas!.height = Math.floor(window.innerHeight * ratio);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }
    resize();

    const onMouseMove = (e: MouseEvent) => {
      const ratio = dpr();
      mouseX = e.clientX * ratio;
      mouseY = e.clientY * ratio;
    };

    const onMouseDown = (e: MouseEvent) => {
      const ratio = dpr();
      ripples.push({
        x: e.clientX * ratio,
        y: e.clientY * ratio,
        t: performance.now() / 1000,
        intensity: 1.0,
      });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);

    const start = performance.now();
    let rafId = 0;

    function draw() {
      const tSec = (performance.now() - start) / 1000;

      // smooth-follow the mouse a touch so the warp feels physical
      smoothedMouseX += (mouseX - smoothedMouseX) * 0.18;
      smoothedMouseY += (mouseY - smoothedMouseY) * 0.18;

      const dotGap = DOT_GAP * dpr();

      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform2f(uMouse, smoothedMouseX, smoothedMouseY);
      gl!.uniform1f(uTime, tSec);
      gl!.uniform1f(uDotGap, dotGap);

      // pack ripples (expired/empty slots zeroed)
      const now = tSec;
      for (let i = 0; i < MAX_RIPPLES; i++) {
        const r = ripples[i];
        if (r && now - r.t < RIPPLE_LIFE) {
          gl!.uniform4f(uRipples[i], r.x, r.y, r.t, r.intensity);
        } else {
          gl!.uniform4f(uRipples[i], 0, 0, 0, 0);
        }
      }
      // garbage-collect old ripples
      while (ripples.length && now - ripples[0].t > RIPPLE_LIFE) ripples.shift();

      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(draw);
    }
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vShader);
      gl.deleteShader(fShader);
    };
  }, []);

  return <canvas ref={canvasRef} className="shader-bg" aria-hidden="true" />;
}
