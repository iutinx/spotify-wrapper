"use client";

import { useEffect, useRef } from "react";

export interface TurntableTrack {
  title: string;
  artist: string;
  ago: string;
  img?: string;
}

interface TurntableProps {
  tracks: TurntableTrack[];
  size?: number;
  tilt?: number;
  autospin?: boolean;
  mono?: boolean;
  className?: string;
}

const deg2rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sdelta = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

class TurntableInstance {
  private root: HTMLElement;
  private tracks: TurntableTrack[];
  private size: number;
  private squash: number;
  private autospin: boolean;
  private focus = -90;
  private rot = 0;
  private vel = 0;
  private target: number | null = null;
  private dragging = false;
  private lastAngle = 0;
  private _lastFocus = -1;
  private step: number;
  private items: HTMLElement[] = [];
  private itemCaps: HTMLElement[] = [];
  private platter!: HTMLElement;
  private arm!: HTMLElement;
  private rafId = 0;
  private destroyed = false;

  constructor(root: HTMLElement, opts: TurntableProps) {
    this.root = root;
    this.tracks = opts.tracks || [];
    this.size = opts.size || 460;
    this.squash = opts.tilt != null ? 0.55 + (1 - opts.tilt) * 0.45 : 0.84;
    this.autospin = opts.autospin || false;
    this.step = 360 / Math.max(this.tracks.length, 1);
    this.build();
    this.bind();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private build() {
    const r = this.root;
    r.classList.add("tt");
    r.style.setProperty("--tt-size", this.size + "px");
    r.innerHTML = "";

    this.platter = document.createElement("div");
    this.platter.className = "tt-platter";
    this.platter.innerHTML =
      '<div class="tt-grooves"></div>' +
      '<div class="tt-label">' +
      '<div class="tt-now">Recently</div>' +
      '<div class="tt-title">—</div>' +
      '<div class="tt-artist">—</div>' +
      '<div class="tt-ago">—</div>' +
      "</div>";
    r.appendChild(this.platter);

    this.arm = document.createElement("div");
    this.arm.className = "tt-arm";
    this.arm.innerHTML =
      '<span class="tt-arm-pivot"></span>' +
      '<span class="tt-arm-rod"></span>' +
      '<span class="tt-arm-head"></span>';
    r.appendChild(this.arm);

    this.items = [];
    this.itemCaps = [];
    this.tracks.forEach((t, i) => {
      const [el, cap] = this.buildItem(t, i);
      this.items.push(el);
      this.itemCaps.push(cap);
      r.appendChild(el);
    });

    const prev = document.createElement("button");
    prev.className = "tt-ctl tt-prev";
    prev.type = "button";
    prev.setAttribute("aria-label", "older track");
    prev.innerHTML = "‹";

    const next = document.createElement("button");
    next.className = "tt-ctl tt-next";
    next.type = "button";
    next.setAttribute("aria-label", "newer track");
    next.innerHTML = "›";

    prev.addEventListener("click", () => this.stepBy(+1));
    next.addEventListener("click", () => this.stepBy(-1));
    r.appendChild(prev);
    r.appendChild(next);
  }

  private buildItem(t: TurntableTrack, i: number): [HTMLElement, HTMLElement] {
    const el = document.createElement("div");
    el.className = "tt-item";
    const hue = (i * 47) % 360;
    el.style.setProperty("--h", String(hue));

    const cover = document.createElement("div");
    cover.className = "tt-cover";
    if (t.img) {
      cover.style.backgroundImage = `url(${t.img})`;
      cover.classList.add("has-img");
    } else {
      const tag = document.createElement("span");
      tag.className = "tt-cover-tag";
      tag.textContent = String(i + 1).padStart(2, "0");
      cover.appendChild(tag);
    }

    const cap = document.createElement("div");
    cap.className = "tt-cap";
    const capT = document.createElement("span");
    capT.className = "tt-cap-t";
    capT.textContent = t.title || "Track";
    const capA = document.createElement("span");
    capA.className = "tt-cap-a";
    capA.textContent = t.artist || "";
    cap.appendChild(capT);
    cap.appendChild(capA);

    el.appendChild(cover);
    el.appendChild(cap);
    return [el, cap];
  }

  private bind() {
    const r = this.root;

    const angleAt = (e: PointerEvent) => {
      const b = r.getBoundingClientRect();
      return (
        (Math.atan2(
          e.clientY - (b.top + b.height / 2),
          e.clientX - (b.left + b.width / 2),
        ) *
          180) /
        Math.PI
      );
    };

    r.addEventListener("pointerdown", (e: Event) => {
      const pe = e as PointerEvent;
      if ((pe.target as Element).closest(".tt-ctl")) return;
      this.dragging = true;
      this.target = null;
      this.vel = 0;
      this.lastAngle = angleAt(pe);
      try {
        r.setPointerCapture(pe.pointerId);
      } catch (_) {}
      r.classList.add("tt-grabbing");
    });

    r.addEventListener("pointermove", (e: Event) => {
      const pe = e as PointerEvent;
      if (!this.dragging) return;
      const a = angleAt(pe);
      const d = sdelta(a, this.lastAngle);
      this.rot += d;
      this.vel = d;
      this.lastAngle = a;
    });

    const release = () => {
      if (!this.dragging) return;
      this.dragging = false;
      r.classList.remove("tt-grabbing");
    };
    r.addEventListener("pointerup", release);
    r.addEventListener("pointercancel", release);

    r.addEventListener(
      "wheel",
      (e: Event) => {
        const we = e as WheelEvent;
        we.preventDefault();
        this.target = null;
        const d = (we.deltaY + we.deltaX) * 0.12;
        this.rot += d;
        this.vel = clamp(d, -8, 8);
      },
      { passive: false },
    );

    r.tabIndex = 0;
    r.addEventListener("keydown", (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "ArrowLeft") {
        this.stepBy(-1);
        ke.preventDefault();
      }
      if (ke.key === "ArrowRight") {
        this.stepBy(+1);
        ke.preventDefault();
      }
    });
  }

  stepBy(dir: number) {
    this.vel = 0;
    const base = this.target ?? this.rot;
    this.target = Math.round(base / this.step) * this.step + dir * this.step;
  }

  goTo(i: number) {
    this.vel = 0;
    this.target = -(i * this.step);
    this.target = Math.round(this.target / this.step) * this.step;
  }

  private loop() {
    if (this.destroyed) return;
    if (!this.dragging) {
      if (this.target !== null) {
        const d = this.target - this.rot;
        this.rot += d * 0.16;
        if (Math.abs(d) < 0.04) {
          this.rot = this.target;
          this.target = null;
        }
      } else {
        if (this.autospin) this.vel += (0.22 - this.vel) * 0.02;
        this.rot += this.vel;
        this.vel *= 0.94;
        if (!this.autospin && Math.abs(this.vel) < 0.16) {
          this.vel = 0;
          this.target = Math.round(this.rot / this.step) * this.step;
        }
      }
    }
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private render() {
    const R = this.size / 2 - this.size * 0.135;
    const cx = this.size / 2;
    const cy = this.size / 2;
    let fIdx = 0;
    let fBest = 999;

    this.items.forEach((el, i) => {
      const a = this.focus + i * this.step + this.rot;
      const x = cx + R * Math.cos(deg2rad(a));
      const y = cy + R * this.squash * Math.sin(deg2rad(a));
      const d = Math.abs(sdelta(a, this.focus));
      const f = (Math.cos(deg2rad(d)) + 1) / 2;
      const op = clamp(0.08 + 0.92 * Math.pow(f, 1.4), 0.05, 1);
      const sc = 0.6 + 0.55 * f;

      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;
      el.style.opacity = op.toFixed(3);
      el.style.zIndex = String(Math.round(f * 100));

      const isFocus = d < this.step / 2;
      el.classList.toggle("tt-focus", isFocus);

      const cap = this.itemCaps[i];
      if (cap) {
        cap.style.opacity = isFocus || f < 0.58 ? "0" : op.toFixed(3);
      }
      if (d < fBest) {
        fBest = d;
        fIdx = i;
      }
    });

    const grooves = this.platter.firstElementChild as HTMLElement;
    if (grooves) grooves.style.transform = `rotate(${(this.rot * 0.6).toFixed(2)}deg)`;

    const armEngaged = Math.abs(this.vel) < 0.6 && !this.dragging;
    this.arm.classList.toggle("engaged", armEngaged);

    const t = this.tracks[fIdx];
    if (t && this._lastFocus !== fIdx) {
      this._lastFocus = fIdx;
      const titleEl = this.platter.querySelector(".tt-title") as HTMLElement;
      const artistEl = this.platter.querySelector(".tt-artist") as HTMLElement;
      const agoEl = this.platter.querySelector(".tt-ago") as HTMLElement;
      if (titleEl) titleEl.textContent = t.title || "—";
      if (artistEl) artistEl.textContent = t.artist || "";
      if (agoEl) agoEl.textContent = t.ago || "";
    }
  }

  setAutospin(v: boolean) {
    this.autospin = v;
    if (v) this.target = null;
  }
  setTilt(v: number) {
    this.squash = 0.55 + (1 - v) * 0.45;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.root.innerHTML = "";
    this.root.classList.remove("tt", "tt-grabbing");
    this.root.style.removeProperty("--tt-size");
  }
}

export function TurntableCarousel({
  tracks,
  size = 440,
  tilt = 0.35,
  autospin = false,
  mono = false,
  className,
}: TurntableProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tracks.length) return;
    const instance = new TurntableInstance(container, {
      tracks,
      size,
      tilt,
      autospin,
      mono,
    });
    return () => instance.destroy();
  }, [tracks, size, tilt, autospin, mono]);

  return <div ref={containerRef} className={className} />;
}
