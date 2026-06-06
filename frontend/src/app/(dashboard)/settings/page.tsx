"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import "./settings.css";

/* ── audience model ───────────────────────────────────────────────────────── */
type Audience = "me" | "friends" | "everyone";
type Viewer = "FRIEND" | "STRANGER";
type ChipKey = "nowplaying" | "topartists" | "minutes" | "clock" | "match";

const AUD_ORDER: Audience[] = ["me", "friends", "everyone"];
const AUD_LABEL: Record<Audience, string> = {
  everyone: "Everyone",
  friends: "Friends only",
  me: "Private",
};

// chip geometry — radius per ring (svg units, /200), drop thresholds, angles
const RING_R: Record<Audience, number> = { me: 58, friends: 116, everyone: 178 };
const DROP = { meMax: 86 / 200, friendsMax: 146 / 200 };

interface ChipDef {
  key: ChipKey;
  angle: number;
  hue: number;
  icon: string;
  name: string;
  initial: Audience;
}

const CHIPS: ChipDef[] = [
  { key: "nowplaying", angle: -54, hue: 8, icon: "▶", name: "Now playing", initial: "friends" },
  { key: "topartists", angle: 18, hue: 54, icon: "★", name: "Top artists", initial: "everyone" },
  { key: "minutes", angle: 90, hue: 150, icon: "⌛", name: "Minutes", initial: "friends" },
  { key: "clock", angle: 162, hue: 220, icon: "◔", name: "Listening clock", initial: "me" },
  { key: "match", angle: 234, hue: 300, icon: "≈", name: "Taste match", initial: "friends" },
];

const ANGLE: Record<ChipKey, number> = Object.fromEntries(
  CHIPS.map((c) => [c.key, c.angle]),
) as Record<ChipKey, number>;

const INITIAL_AUD: Record<ChipKey, Audience> = Object.fromEntries(
  CHIPS.map((c) => [c.key, c.initial]),
) as Record<ChipKey, Audience>;

// the "Now playing" chip mirrors the real backend activity-visibility field
type ActivityVisibility = "public" | "friends_only" | "private";
const AUD_TO_VIS: Record<Audience, ActivityVisibility> = {
  everyone: "public",
  friends: "friends_only",
  me: "private",
};
const VIS_TO_AUD: Record<ActivityVisibility, Audience> = {
  public: "everyone",
  friends_only: "friends",
  private: "me",
};

function isVisible(aud: Audience, viewer: Viewer): boolean {
  if (aud === "me") return false;
  if (aud === "everyone") return true;
  return viewer === "FRIEND";
}

/* ── avatar disk ──────────────────────────────────────────────────────────── */
function Avatar({
  src,
  className,
  style,
}: {
  src?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`st-avatar${className ? " " + className : ""}`} style={style}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="avatar" />
      )}
    </div>
  );
}

const MINI_CLOCK = [30, 48, 58, 42, 64, 82, 98, 72, 52, 36];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // ── profile fields ──
  const [name, setName] = useState("listener");
  const [handle, setHandle] = useState("listener_42");
  const [bio, setBio] = useState("indie kid, perpetual lo-fi");
  const seededRef = useRef(false);

  // ── audience state ──
  const [aud, setAudState] = useState<Record<ChipKey, Audience>>(INITIAL_AUD);
  const audRef = useRef(aud);
  useEffect(() => {
    audRef.current = aud;
  }, [aud]);
  const [viewer, setViewer] = useState<Viewer>("FRIEND");

  // ── save + toast state ──
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── backend wiring ──
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await apiClient.get<{ profile?: { activity_visibility?: string } }>(
        "/api/users/me",
      );
      return res.data;
    },
  });

  const updatePrivacyMutation = useMutation({
    mutationFn: async (visibility: ActivityVisibility) => {
      const res = await apiClient.put("/api/users/me/activity-privacy", {
        activity_privacy: visibility,
      });
      return res.data;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/api/auth/logout");
    },
    onSuccess: () => {
      logout();
      router.push("/login");
    },
  });

  // seed profile + nowplaying audience from the authed user / backend once
  useEffect(() => {
    if (user && !seededRef.current) {
      seededRef.current = true;
      const display = user.display_name || "listener";
      setName(display);
      setHandle(display.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "listener_42");
    }
  }, [user]);

  useEffect(() => {
    const vis = meData?.profile?.activity_visibility;
    if (vis === "public" || vis === "friends_only" || vis === "private") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing audience from backend
      setAudState((prev) => ({ ...prev, nowplaying: VIS_TO_AUD[vis] }));
    }
  }, [meData]);

  const pulseSave = useCallback(() => {
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaving(false), 600);
  }, []);

  const toast = useCallback((text: string, ok = true) => {
    setToastMsg({ text, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  /* ── orbit positioning ── */
  const orbitRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const positionChip = useCallback((key: ChipKey, audience: Audience, animate = true) => {
    const orbit = orbitRef.current;
    const chip = chipRefs.current[key];
    if (!orbit || !chip) return;
    const size = orbit.getBoundingClientRect().width;
    if (size < 20) return; // not laid out yet
    if (!animate) {
      chip.style.transition = "none";
      void chip.offsetWidth; // commit no-transition before moving
    }
    const r = (RING_R[audience] / 200) * (size / 2);
    const ang = (ANGLE[key] * Math.PI) / 180;
    chip.style.left = size / 2 + r * Math.cos(ang) + "px";
    chip.style.top = size / 2 + r * Math.sin(ang) + "px";
    chip.classList.add("placed");
    if (!animate) {
      void chip.offsetWidth;
      chip.style.transition = "";
    }
  }, []);

  // initial placement + re-layout on resize (no animation)
  useEffect(() => {
    const orbit = orbitRef.current;
    if (!orbit) return;
    let first = true;
    const place = () => {
      if (orbit.getBoundingClientRect().width < 20) return;
      CHIPS.forEach((c) => positionChip(c.key, audRef.current[c.key], !first));
      first = false;
    };
    const ro = new ResizeObserver(place);
    ro.observe(orbit);
    const raf = requestAnimationFrame(place);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [positionChip]);

  // animate chips to their rings whenever the audience changes (after first paint)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    CHIPS.forEach((c) => positionChip(c.key, aud[c.key], true));
  }, [aud, positionChip]);

  const audFromPoint = useCallback((clientX: number, clientY: number): Audience => {
    const orbit = orbitRef.current;
    if (!orbit) return "friends";
    const rect = orbit.getBoundingClientRect();
    const dx = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const dy = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < DROP.meMax) return "me";
    if (d < DROP.friendsMax) return "friends";
    return "everyone";
  }, []);

  const setAud = useCallback(
    (key: ChipKey, audience: Audience, silent = false) => {
      setAudState((prev) => ({ ...prev, [key]: audience }));
      if (key === "nowplaying") updatePrivacyMutation.mutate(AUD_TO_VIS[audience]);
      if (!silent) {
        const def = CHIPS.find((c) => c.key === key);
        toast(`${def?.name} → ${AUD_LABEL[audience]}`);
        pulseSave();
      }
    },
    [pulseSave, toast, updatePrivacyMutation],
  );

  /* ── drag handlers ── */
  const dragRef = useRef<{ key: ChipKey; moved: boolean; sx: number; sy: number } | null>(null);

  const onChipPointerDown = (e: React.PointerEvent<HTMLButtonElement>, key: ChipKey) => {
    e.preventDefault();
    const chip = chipRefs.current[key];
    chip?.setPointerCapture(e.pointerId);
    chip?.classList.add("dragging");
    dragRef.current = { key, moved: false, sx: e.clientX, sy: e.clientY };
  };

  const onChipPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;
    const orbit = orbitRef.current;
    const chip = chipRefs.current[d.key];
    if (!orbit || !chip) return;
    const rect = orbit.getBoundingClientRect();
    chip.style.transition = "none";
    chip.style.left = e.clientX - rect.left + "px";
    chip.style.top = e.clientY - rect.top + "px";
    const a = audFromPoint(e.clientX, e.clientY);
    orbit.classList.toggle("drag-everyone", a === "everyone");
    orbit.classList.toggle("drag-friends", a === "friends");
    orbit.classList.toggle("drag-me", a === "me");
  };

  const onChipPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    const chip = chipRefs.current[d.key];
    chip?.classList.remove("dragging");
    if (chip) chip.style.transition = "";
    const orbit = orbitRef.current;
    orbit?.classList.remove("drag-everyone", "drag-friends", "drag-me");
    if (d.moved) {
      setAud(d.key, audFromPoint(e.clientX, e.clientY));
    } else {
      const i = AUD_ORDER.indexOf(aud[d.key]);
      setAud(d.key, AUD_ORDER[(i + 1) % AUD_ORDER.length]);
    }
  };

  /* ── derived ── */
  const cleanHandle = handle.replace(/^@/, "") || "handle";
  const legend = { everyone: 0, friends: 0, me: 0 };
  (Object.values(aud) as Audience[]).forEach((a) => legend[a]++);

  const previewRows: { key: ChipKey; k: string; body: React.ReactNode }[] = [
    {
      key: "nowplaying",
      k: "Now",
      body: (
        <>
          <span className="db-eq">
            <i />
            <i />
            <i />
          </span>{" "}
          Slow Tide<small>· Marrow</small>
        </>
      ),
    },
    { key: "topartists", k: "Top", body: <>Marrow<small>+ 4 more</small></> },
    { key: "minutes", k: "Mins", body: <>8.4k<small>this month</small></> },
    {
      key: "clock",
      k: "Clock",
      body: (
        <>
          <span className="st-mini-clock">
            {MINI_CLOCK.map((h, i) => (
              <i key={i} style={{ height: `${h}%` }} />
            ))}
          </span>
          <small>peak 9pm</small>
        </>
      ),
    },
    { key: "match", k: "Match", body: <>92%<small>with you</small></> },
  ];

  const visibleCount = previewRows.filter((r) => isVisible(aud[r.key], viewer)).length;
  const total = previewRows.length;
  const countClass = visibleCount === 0 ? "none" : visibleCount < total ? "partial" : "";

  const onProfileEdit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    pulseSave();
  };

  const handleDisconnect = () => {
    if (
      confirm(
        "Are you sure you want to disconnect Spotify? You will be logged out and need to reconnect to use the app.",
      )
    ) {
      disconnectMutation.mutate();
    }
  };

  return (
    <main className="db-page">
      {/* head row */}
      <div className="db-head-row">
        <div>
          <div className="db-eyebrow">Account &amp; sharing</div>
          <h1 className="db-greeting">
            Tune <em>your signal</em>.
          </h1>
        </div>
        <span className={`st-save-state${saving ? " saving" : ""}`}>
          <span className="st-save-check">{saving ? "…" : "✓"}</span>
          {saving ? "Saving" : "Auto-saved"}
        </span>
      </div>

      {/* ═══════════ HERO ═══════════ */}
      <section className="st-hero">
        {/* LEFT: identity + sync */}
        <div className="st-hero-side">
          <div className="db-card st-identity">
            <div className="db-card-head">
              <span className="db-lbl">You</span>
              <span className="db-live-tag">
                <span className="db-pulse" />
                linked
              </span>
            </div>
            <div className="st-id-block">
              <Avatar src={user?.profile_image_url} />
              <div className="st-display-name">{name || "listener"}</div>
              <div className="st-handle">@{cleanHandle}</div>
            </div>
            <div className="st-id-foot">
              <div className="st-id-row">
                <span className="st-id-k">Email</span>
                <span className="st-id-v">{user?.email || "listener@email.com"}</span>
              </div>
              <div className="st-id-row">
                <span className="st-id-k">Plan</span>
                <span className="st-id-v">Spotify Premium</span>
              </div>
              <div className="st-id-row">
                <span className="st-id-k">Member since</span>
                <span className="st-id-v">Mar 2024</span>
              </div>
            </div>
          </div>

          <div className="db-card">
            <div className="db-card-head">
              <span className="db-lbl">Library sync</span>
              <span className="db-lbl" style={{ color: "var(--db-ink-soft)" }}>
                auto
              </span>
            </div>
            <div className="db-stat">
              2<small> min ago</small>
            </div>
            <div className="db-stat-cap">
              <span style={{ color: "var(--db-spotify)", fontWeight: 600 }}>+1,204</span> new plays
              today
            </div>
            <div className="st-btn-row">
              <button className="db-btn" onClick={() => toast("Re-sync started…")}>
                Re-sync ▸
              </button>
              <button
                className="db-btn ghost danger"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        </div>

        {/* CENTER: the orbit */}
        <div className="db-card st-orbit-card">
          <div className="db-card-head" style={{ justifyContent: "space-between" }}>
            <span className="db-lbl">Sharing · drag to set audience</span>
            <span className="db-lbl" style={{ color: "var(--db-ink-soft)" }}>
              tap to cycle outward
            </span>
          </div>

          <div className="st-orbit-stage" ref={orbitRef}>
            <svg className="st-orbit-svg" viewBox="0 0 400 400" aria-hidden="true">
              <circle className="st-ring-fill-e" cx="200" cy="200" r="178" />
              <circle className="st-ring-fill-f" cx="200" cy="200" r="116" />
              <circle className="st-ring-fill-m" cx="200" cy="200" r="58" />
              <circle className="st-orbit-ring st-ring-e dashed" cx="200" cy="200" r="178" />
              <circle className="st-orbit-ring st-ring-f dashed" cx="200" cy="200" r="116" />
              <circle className="st-orbit-ring st-ring-m" cx="200" cy="200" r="58" />
            </svg>

            <span className="st-ring-lbl r-everyone">🌐 Everyone</span>
            <span className="st-ring-lbl r-friends">Friends only</span>
            <span className="st-ring-lbl r-me">Private</span>

            <div className="st-orbit-you">
              <Avatar src={user?.profile_image_url} />
              <div className="st-orbit-you-lbl">you</div>
            </div>

            {CHIPS.map((c) => (
              <button
                key={c.key}
                ref={(el) => {
                  chipRefs.current[c.key] = el;
                }}
                className="st-chip"
                data-aud={aud[c.key]}
                onPointerDown={(e) => onChipPointerDown(e, c.key)}
                onPointerMove={onChipPointerMove}
                onPointerUp={onChipPointerUp}
                onPointerCancel={onChipPointerUp}
              >
                <span className="st-chip-icon" style={{ ["--h" as string]: String(c.hue) }}>
                  {c.icon}
                </span>
                <span className="st-chip-name">{c.name}</span>
              </button>
            ))}
          </div>

          <div className="st-orbit-hint">drag outward to share wider · drop in any ring</div>

          <div className="st-legend">
            <span className="st-olg e">
              <span className="st-olg-dot" />
              <b>{legend.everyone}</b> public
            </span>
            <span className="st-olg f">
              <span className="st-olg-dot" />
              <b>{legend.friends}</b> friends
            </span>
            <span className="st-olg m">
              <span className="st-olg-dot" />
              <b>{legend.me}</b> private
            </span>
          </div>
        </div>

        {/* RIGHT: live preview */}
        <div className="st-hero-side">
          <div className="db-card st-preview" style={{ flex: 1 }}>
            <div className="db-card-head">
              <span className="db-lbl">Live preview</span>
              <div className="st-viewer">
                {(["FRIEND", "STRANGER"] as Viewer[]).map((v) => (
                  <button
                    key={v}
                    className={viewer === v ? "on" : ""}
                    onClick={() => setViewer(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="st-pv-id">
              <Avatar src={user?.profile_image_url} />
              <div>
                <div className="st-pv-name">{name || "listener"}</div>
                <div className="st-pv-handle">@{cleanHandle}</div>
              </div>
            </div>

            <div className="st-pv-rows">
              {previewRows.map((r) => {
                const hidden = !isVisible(aud[r.key], viewer);
                return (
                  <div key={r.key} className={`st-pv-row${hidden ? " hidden" : ""}`}>
                    <span className="st-pvk">{r.k}</span>
                    <span className="st-pvv">{r.body}</span>
                  </div>
                );
              })}
            </div>

            <div className="st-pv-foot">
              <span>card mockup</span>
              <span className={`st-visible-count${countClass ? " " + countClass : ""}`}>
                {visibleCount}/{total} visible
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ BELOW HERO ═══════════ */}
      <section className="db-modules">
        {/* profile editor */}
        <div className="db-card st-m-profile">
          <div className="db-card-head">
            <span className="db-lbl">Profile</span>
            <span className="db-lbl" style={{ color: "var(--db-ink-soft)" }}>
              edits sync to your card ↑
            </span>
          </div>
          <div className="st-prof-rows">
            <div className="st-prof-row">
              <span className="st-pk">Avatar</span>
              <div className="st-pv">
                <div className="st-upload">
                  <Avatar src={user?.profile_image_url} />
                  <div className="st-upload-actions">
                    <button className="db-btn" onClick={() => toast("Upload avatar")}>
                      Upload
                    </button>
                    <button
                      className="db-btn ghost"
                      onClick={() => toast("Reset to Spotify avatar")}
                    >
                      Use Spotify
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="st-prof-row">
              <span className="st-pk">Display name</span>
              <div className="st-pv">
                <input
                  className="st-prof-input"
                  type="text"
                  maxLength={32}
                  value={name}
                  onChange={(e) => onProfileEdit(setName)(e.target.value)}
                />
                <span className="st-prof-hint">
                  Shown on leaderboards and your profile card.
                </span>
              </div>
            </div>
            <div className="st-prof-row">
              <span className="st-pk">Handle</span>
              <div className="st-pv">
                <input
                  className="st-prof-input"
                  type="text"
                  maxLength={20}
                  value={handle}
                  onChange={(e) => onProfileEdit(setHandle)(e.target.value)}
                />
                <span className="st-prof-hint">Your unique @ for friends to find you.</span>
              </div>
            </div>
            <div className="st-prof-row">
              <span className="st-pk">Bio</span>
              <div className="st-pv">
                <textarea
                  className="st-prof-input"
                  rows={2}
                  maxLength={140}
                  value={bio}
                  onChange={(e) => onProfileEdit(setBio)(e.target.value)}
                />
                <span className="st-prof-hint">{bio.length} / 140</span>
              </div>
            </div>
          </div>
        </div>

        {/* account / danger */}
        <div className="db-card st-m-account">
          <div className="db-card-head">
            <span className="db-lbl">Account</span>
          </div>
          <div className="st-acc-rows">
            <div className="st-acc-row">
              <div>
                <div className="st-ak">Export my data</div>
                <div className="st-ad">
                  Download everything Resonance has stored about you, as JSON.
                </div>
              </div>
              <button className="db-btn" onClick={() => toast("Preparing export…")}>
                Export ▸
              </button>
            </div>
            <div className="st-acc-row">
              <div>
                <div className="st-ak">Clear listening history</div>
                <div className="st-ad">
                  Wipes your stats but keeps the account. Not reversible.
                </div>
              </div>
              <button
                className="db-btn ghost danger"
                onClick={() => toast("Clear history — confirm dialog")}
              >
                Clear
              </button>
            </div>
            <div className="st-acc-row danger">
              <div>
                <div className="st-ak">Delete account</div>
                <div className="st-ad">
                  Permanent. Removes your profile, stats, and friends connections.
                </div>
              </div>
              <button
                className="db-btn danger"
                onClick={() => toast("Delete account — confirm dialog")}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <div className="db-footer">
        <span>© Resonance 2026</span>
        <span className="db-footer-live">
          <span className="db-pulse" />
          Synced with Spotify · 2 min ago
        </span>
        <span>v0.4.2 · build 1142</span>
      </div>

      {/* toast */}
      <div className={`st-toast${toastMsg ? " show" : ""}`}>
        {toastMsg?.ok && <span className="st-toast-check" />}
        {toastMsg?.text}
      </div>
    </main>
  );
}
