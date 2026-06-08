"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import {
  useMe,
  useUpdateProfile,
  useUploadAvatar,
  useResetAvatar,
  useExportData,
  useClearHistory,
  useDeleteAccount,
  type ProfileUpdate,
} from "@/hooks/useProfile";
import {
  useSyncAnalytics,
  useListeningStats,
  useTopArtists,
  useTopTracks,
} from "@/hooks/useAnalytics";
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

// chip audience <-> backend visibility
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

// avatar_url from the backend is relative ("/media/...") to the API host
const MEDIA_BASE = process.env.NEXT_PUBLIC_API_URL || "https://127.0.0.1:5000";
function resolveAvatar(avatarUrl?: string | null, spotifyUrl?: string | null): string | null {
  if (avatarUrl) {
    return avatarUrl.startsWith("http") ? avatarUrl : `${MEDIA_BASE}${avatarUrl}`;
  }
  return spotifyUrl ?? null;
}

// Backend serializes naive UTC datetimes without a timezone suffix, which the
// browser would otherwise parse as local time. Append "Z" so it's read as UTC.
function parseUtc(dateStr: string): Date {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(dateStr);
  return new Date(hasTz ? dateStr : dateStr + "Z");
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - parseUtc(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function formatThousands(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function memberSince(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function prettyPlan(product?: string | null): string {
  if (!product) return "Spotify";
  return "Spotify " + product.charAt(0).toUpperCase() + product.slice(1);
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

const DEFAULT_BIO = "indie kid, perpetual lo-fi";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { data: me } = useMe();
  const profile = me?.profile ?? null;
  const updateProfile = useUpdateProfile(me?.id);
  const uploadAvatar = useUploadAvatar();
  const resetAvatar = useResetAvatar();
  const exportData = useExportData();
  const clearHistory = useClearHistory();
  const deleteAccount = useDeleteAccount();
  const syncAnalytics = useSyncAnalytics();
  const { data: stats } = useListeningStats();
  const { data: topArtists } = useTopArtists("short_term");
  const { data: topTracks } = useTopTracks("short_term");

  const avatarSrc = resolveAvatar(profile?.avatar_url, me?.profile_image_url ?? user?.profile_image_url);

  // ── profile fields ──
  const [name, setName] = useState("listener");
  const [handle, setHandle] = useState("listener_42");
  const [bio, setBio] = useState(DEFAULT_BIO);
  const [handleError, setHandleError] = useState<string | null>(null);
  const profileSeeded = useRef(false);

  // ── audience state ──
  const [aud, setAudState] = useState<Record<ChipKey, Audience>>(INITIAL_AUD);
  const audRef = useRef(aud);
  useEffect(() => {
    audRef.current = aud;
  }, [aud]);
  const [viewer, setViewer] = useState<Viewer>("FRIEND");

  // ── explicit save: snapshot of the last-saved state to diff against ──
  const [baseline, setBaseline] = useState<{
    name: string;
    handle: string;
    bio: string;
    aud: Record<ChipKey, Audience>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // seed editable fields + audience once /me arrives (sync from server data) and
  // record that snapshot as the baseline we diff against for the explicit save.
  useEffect(() => {
    if (!me || profileSeeded.current) return;
    profileSeeded.current = true;

    const seededName = me.display_name || "listener";
    const seededHandle =
      me.profile?.handle ||
      (me.display_name
        ? me.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
        : "listener_42");
    const seededBio = me.profile?.bio ?? DEFAULT_BIO;

    const seededAud: Record<ChipKey, Audience> = { ...INITIAL_AUD };
    const share = me.profile?.share_settings;
    if (share) {
      (Object.keys(seededAud) as ChipKey[]).forEach((k) => {
        const vis = share[k];
        if (vis) seededAud[k] = VIS_TO_AUD[vis];
      });
    } else if (me.profile?.activity_visibility) {
      seededAud.nowplaying = VIS_TO_AUD[me.profile.activity_visibility];
    }

    setName(seededName);
    setHandle(seededHandle);
    setBio(seededBio);
    setAudState(seededAud);
    setBaseline({ name: seededName, handle: seededHandle, bio: seededBio, aud: seededAud });
  }, [me]);

  // build a payload containing only the fields that differ from the last-saved
  // baseline (profile fields + per-card sharing audiences). null when nothing changed.
  const buildDirtyPayload = useCallback((): ProfileUpdate | null => {
    const base = baseline;
    if (!base) return null;
    const payload: ProfileUpdate = {};
    if (name !== base.name) payload.display_name = name;
    if (handle !== base.handle) payload.handle = handle;
    if (bio !== base.bio) payload.bio = bio;
    const shareDiff: Partial<Record<ChipKey, ActivityVisibility>> = {};
    (Object.keys(aud) as ChipKey[]).forEach((k) => {
      if (aud[k] !== base.aud[k]) shareDiff[k] = AUD_TO_VIS[aud[k]];
    });
    if (Object.keys(shareDiff).length > 0) {
      payload.share_settings = shareDiff as ProfileUpdate["share_settings"];
    }
    return Object.keys(payload).length > 0 ? payload : null;
  }, [baseline, name, handle, bio, aud]);

  const isDirty = buildDirtyPayload() !== null;

  const onSave = useCallback(() => {
    const payload = buildDirtyPayload();
    if (!payload) return;
    updateProfile.mutate(payload, {
      onSuccess: () => {
        setHandleError(null);
        setBaseline({ name, handle, bio, aud });
        toast("Changes saved");
      },
      onError: (err) => {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          setHandleError("That handle is already taken");
          toast("Handle already taken", "error");
        } else {
          toast("Couldn't save changes", "error");
        }
      },
    });
  }, [buildDirtyPayload, updateProfile, name, handle, bio, aud, toast]);

  const onDiscard = useCallback(() => {
    if (!baseline) return;
    setName(baseline.name);
    setHandle(baseline.handle);
    setBio(baseline.bio);
    setAudState(baseline.aud);
    setHandleError(null);
  }, [baseline]);

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
    (key: ChipKey, audience: Audience) => {
      setAudState((prev) => ({ ...prev, [key]: audience }));
      const def = CHIPS.find((c) => c.key === key);
      toast(`${def?.name} → ${AUD_LABEL[audience]}`);
      // staged only; persisted together with the rest on "Save changes"
    },
    [toast],
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

  /* ── profile field edits ── */
  const onNameChange = (v: string) => setName(v);
  const onHandleChange = (v: string) => {
    setHandle(v);
    setHandleError(null);
  };
  const onBioChange = (v: string) => setBio(v);

  /* ── avatar ── */
  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("Image must be 2MB or smaller", "error");
      return;
    }
    uploadAvatar.mutate(file, {
      onSuccess: () => toast("Avatar updated"),
      onError: (err) => {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status === 413) toast("Image must be 2MB or smaller", "error");
        else if (status === 400) toast("Use a PNG, JPEG, or WebP image", "error");
        else toast("Avatar upload failed", "error");
      },
    });
  };
  const onUseSpotify = () => {
    resetAvatar.mutate(undefined, {
      onSuccess: () => toast("Reverted to Spotify avatar"),
      onError: () => toast("Couldn't reset avatar", "error"),
    });
  };

  /* ── account actions ── */
  const onExport = () => {
    toast("Preparing export…");
    exportData.mutate(undefined, {
      onSuccess: () => toast("Export downloaded"),
      onError: async (err) => {
        // the error body comes back as a Blob (responseType: "blob"); try to
        // surface the backend's message, otherwise fall back to a generic one.
        let message = "Export failed";
        if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
          try {
            const parsed = JSON.parse(await err.response.data.text());
            if (parsed?.detail) message = String(parsed.detail);
          } catch {
            /* keep generic message */
          }
        }
        toast(message, "error");
      },
    });
  };
  const onClearHistory = () => {
    if (!confirm("Clear your listening history? This wipes your stats but keeps your account. Not reversible.")) return;
    clearHistory.mutate(undefined, {
      onSuccess: () => toast("Listening history cleared"),
      onError: () => toast("Couldn't clear history", "error"),
    });
  };
  const onDeleteAccount = () => {
    if (!confirm("Permanently delete your account? This removes your profile, stats, and friend connections. This cannot be undone.")) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        logout();
        router.push("/login");
      },
      onError: () => toast("Couldn't delete account", "error"),
    });
  };
  const onResync = () => {
    syncAnalytics.mutate(undefined, {
      onSuccess: () => toast("Re-sync complete"),
      onError: () => toast("Re-sync failed", "error"),
    });
  };
  const handleDisconnect = () => {
    if (confirm("Disconnect Spotify? You'll be logged out and need to reconnect to use the app.")) {
      logout();
      router.push("/login");
    }
  };

  /* ── derived ── */
  const cleanHandle = handle.replace(/^@/, "") || "handle";
  const legend = { everyone: 0, friends: 0, me: 0 };
  (Object.values(aud) as Audience[]).forEach((a) => legend[a]++);

  const minutesValue = stats ? Math.round(stats.total_hours_listened * 60) : null;
  const topArtistList = topArtists?.artists ?? [];
  const topArtistNames = topArtistList.slice(0, 3).map((a) => a.artist_name).join(" · ");
  const hasMoreArtists = topArtistList.length > 3;
  const nowTrack = topTracks?.tracks?.[0] ?? null;

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
          {nowTrack ? (
            <>
              {nowTrack.track_name}
              <small>· {nowTrack.artist_name}</small>
            </>
          ) : (
            <>Slow Tide<small>· Marrow</small></>
          )}
        </>
      ),
    },
    {
      key: "topartists",
      k: "Top",
      body: topArtistNames ? (
        <>
          {topArtistNames}
          {hasMoreArtists && <small>…</small>}
        </>
      ) : (
        <>Marrow · Tycho · Boards<small>…</small></>
      ),
    },
    {
      key: "minutes",
      k: "Mins",
      body:
        minutesValue != null ? (
          <>
            {formatThousands(minutesValue)}
            <small>all time</small>
          </>
        ) : (
          <>8.4k<small>this month</small></>
        ),
    },
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

  const bioLen = bio.length;

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
        <div className="st-save-bar">
          {isDirty && (
            <button
              className="db-btn ghost"
              onClick={onDiscard}
              disabled={updateProfile.isPending}
            >
              Discard
            </button>
          )}
          <button
            className="db-btn"
            onClick={onSave}
            disabled={!isDirty || updateProfile.isPending}
          >
            {updateProfile.isPending ? "Saving…" : isDirty ? "Save changes" : "Saved"}
          </button>
        </div>
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
              <Avatar src={avatarSrc} />
              <div className="st-display-name">{name || "listener"}</div>
              <div className="st-handle">@{cleanHandle}</div>
            </div>
            <div className="st-id-foot">
              <div className="st-id-row">
                <span className="st-id-k">Email</span>
                <span className="st-id-v">{me?.email || user?.email || "—"}</span>
              </div>
              <div className="st-id-row">
                <span className="st-id-k">Plan</span>
                <span className="st-id-v">{prettyPlan(me?.spotify_product)}</span>
              </div>
              <div className="st-id-row">
                <span className="st-id-k">Member since</span>
                <span className="st-id-v">{memberSince(me?.created_at)}</span>
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
            <div className="db-stat">{timeAgo(me?.last_spotify_sync)}</div>
            <div className="db-stat-cap">
              <span style={{ color: "var(--db-spotify)", fontWeight: 600 }}>
                +{(me?.plays_today ?? 0).toLocaleString()}
              </span>{" "}
              new plays today
            </div>
            <div className="st-btn-row">
              <button className="db-btn" onClick={onResync} disabled={syncAnalytics.isPending}>
                {syncAnalytics.isPending ? "Syncing…" : "Re-sync ▸"}
              </button>
              <button className="db-btn ghost danger" onClick={handleDisconnect}>
                Disconnect
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
              <Avatar src={avatarSrc} />
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
              <Avatar src={avatarSrc} />
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
                  <Avatar src={avatarSrc} />
                  <div className="st-upload-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: "none" }}
                      onChange={onAvatarFile}
                    />
                    <button
                      className="db-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadAvatar.isPending}
                    >
                      {uploadAvatar.isPending ? "Uploading…" : "Upload"}
                    </button>
                    <button
                      className="db-btn ghost"
                      onClick={onUseSpotify}
                      disabled={resetAvatar.isPending}
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
                  onChange={(e) => onNameChange(e.target.value)}
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
                  maxLength={30}
                  value={handle}
                  onChange={(e) => onHandleChange(e.target.value)}
                />
                <span
                  className="st-prof-hint"
                  style={handleError ? { color: "var(--db-danger)" } : undefined}
                >
                  {handleError || "Your unique @ for friends to find you."}
                </span>
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
                  onChange={(e) => onBioChange(e.target.value)}
                />
                <span className="st-prof-hint">{bioLen} / 140</span>
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
              <button className="db-btn" onClick={onExport} disabled={exportData.isPending}>
                {exportData.isPending ? "Exporting…" : "Export ▸"}
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
                onClick={onClearHistory}
                disabled={clearHistory.isPending}
              >
                {clearHistory.isPending ? "Clearing…" : "Clear"}
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
                onClick={onDeleteAccount}
                disabled={deleteAccount.isPending}
              >
                {deleteAccount.isPending ? "Deleting…" : "Delete"}
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
          Synced with Spotify · {timeAgo(me?.last_spotify_sync)}
        </span>
        <span>v0.4.2 · build 1142</span>
      </div>
    </main>
  );
}
