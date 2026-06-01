"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useFriends } from "@/hooks/useSocial";
import { MatchDetailSheet } from "@/components/social/match-detail";
import type { Friend, LeaderboardEntry, MusicMatch } from "@/types";

const SEG_LABELS = ["THIS WEEK", "6 MONTHS", "ALL TIME"] as const;

/* format a minute count as "8.4k" / "920" */
function formatMins(totalMinutes: number): string {
  if (totalMinutes >= 1000) {
    return (totalMinutes / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return Math.round(totalMinutes).toString();
}

/* mm:ss from a millisecond offset */
function msToClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* deterministic gradient angle from a string id */
function angleFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `${h}deg`;
}

/* ── match dial (SVG donut with centered number) ── */
function Dial({ pct, size = 84, label }: { pct: number; size?: number; label?: string }) {
  const small = size <= 52;
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  const numFs = small ? 40 : 34;
  const sw = small ? 8 : 7;
  return (
    <span className="db-dial">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--db-hair)" strokeWidth={sw} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--db-spotify)"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y={label ? 46 : 50}
          textAnchor="middle"
          dominantBaseline="central"
          className="db-dial-num"
          fontSize={numFs}
        >
          {pct}
          {!small && (
            <tspan className="db-dial-pc" fontSize="16">
              %
            </tspan>
          )}
        </text>
        {label && (
          <text x="50" y="70" textAnchor="middle" className="db-dial-lbl" fontSize="8">
            {label}
          </text>
        )}
      </svg>
    </span>
  );
}

/* ── play-progress ring around a live avatar ── */
function AvRing({ prog, a, image }: { prog: number; a: string; image?: string | null }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const off = c * (1 - prog / 100);
  return (
    <span className="db-av-ring">
      <svg viewBox="0 0 40 40" width="40" height="40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--db-hair)" strokeWidth="2.5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--db-spotify)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span
        className={`db-favatar${image ? "" : " gen"}`}
        style={
          image
            ? { backgroundImage: `url(${image})` }
            : ({ "--a": a } as React.CSSProperties)
        }
      />
    </span>
  );
}

/* ── placeholder data (used when the API has nothing yet) ── */
const PODIUM_FALLBACK = [
  { cls: "p2", name: "Devin K.", mins: "7.1k", a: "160deg", rank: 2 },
  { cls: "p1", name: "Ava R.", mins: "8.4k", a: "20deg", rank: 1 },
  { cls: "p3", name: "Mona L.", mins: "6.3k", a: "280deg", rank: 3 },
];
const ROWS_FALLBACK = [
  { rank: 4, name: "Theo W.", a: "70deg", bar: 70, mins: "5.9k", pct: 78 },
  { rank: 5, name: "Priya S.", a: "110deg", bar: 62, mins: "5.2k", pct: 74 },
  { rank: 6, name: "Sam O.", a: "20deg", bar: 54, mins: "4.8k", pct: 69 },
  { rank: 7, name: "Noor A.", a: "300deg", bar: 46, mins: "4.1k", pct: 63 },
];
const LIVE_FALLBACK = [
  { name: "Ava R.", track: "Slow Tide — Marrow", a: "20deg", prog: 64, time: "0:41" },
  { name: "Devin K.", track: "Amber Hours — Kite Season", a: "160deg", prog: 40, time: "1:52" },
  { name: "Priya S.", track: "Northbound — Halcyon Bay", a: "110deg", prog: 80, time: "0:33" },
  { name: "Sam O.", track: "Last Train — Echo & Ivy", a: "300deg", prog: 24, time: "2:48" },
];

export default function FriendsPage() {
  const { user: currentUser } = useAuth();
  const [segIdx, setSegIdx] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: friends } = useFriends();

  const { data: leaderboard } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ entries: LeaderboardEntry[] }>("/api/social/leaderboard");
        return res.data.entries || [];
      } catch {
        return [];
      }
    },
  });

  /* closest match = friend with the highest match percentage */
  const closestFriend = useMemo<Friend | null>(() => {
    if (!friends || friends.length === 0) return null;
    return [...friends].sort(
      (a, b) => (b.music_match_percentage || 0) - (a.music_match_percentage || 0),
    )[0];
  }, [friends]);

  /* full breakdown for the closest match (shared genres/artists, compare sheet) */
  const { data: closestMatch } = useQuery({
    queryKey: ["music-match", closestFriend?.user_id],
    queryFn: async () => {
      if (!closestFriend) return null;
      const res = await apiClient.get<MusicMatch>(`/api/social/match/${closestFriend.user_id}`);
      return res.data;
    },
    enabled: !!closestFriend,
  });

  /* ── leaderboard → podium (1-3) + rows (4-7) ── */
  const lbEntries = leaderboard ?? [];
  const maxMins = useMemo(() => {
    const top = lbEntries[0];
    return top ? Math.max(top.total_hours_listened * 60, 1) : 1;
  }, [lbEntries]);

  const podium = useMemo(() => {
    if (lbEntries.length < 3) return null;
    const [first, second, third] = lbEntries;
    const cell = (e: LeaderboardEntry, cls: string) => ({
      cls,
      rank: e.rank,
      name: e.user.display_name,
      mins: formatMins(e.total_hours_listened * 60),
      image: e.user.profile_image_url,
      a: angleFor(e.user.id),
    });
    return [cell(second, "p2"), cell(first, "p1"), cell(third, "p3")];
  }, [lbEntries]);

  const rows = useMemo(() => {
    if (lbEntries.length < 4) return null;
    return lbEntries.slice(3, 7).map((e) => ({
      rank: e.rank,
      name: e.user.display_name,
      image: e.user.profile_image_url,
      a: angleFor(e.user.id),
      bar: Math.round((e.total_hours_listened * 60 * 100) / maxMins),
      mins: formatMins(e.total_hours_listened * 60),
      pct: Math.max(40, Math.round((e.total_hours_listened * 60 * 100) / maxMins)),
    }));
  }, [lbEntries, maxMins]);

  /* ── friends listening live right now ── */
  const liveFriends = useMemo(() => {
    if (!friends) return null;
    const playing = friends
      .filter((f) => f.currently_playing?.is_playing && f.currently_playing.track.track_name)
      .map((f) => {
        const cp = f.currently_playing!;
        const dur = cp.track.duration_ms || 0;
        const prog = dur > 0 ? Math.min(100, Math.round((cp.progress_ms / dur) * 100)) : 0;
        return {
          name: f.display_name,
          track: `${cp.track.track_name} — ${cp.track.artist_name ?? "Unknown"}`,
          image: f.profile_image_url,
          a: angleFor(f.user_id),
          prog,
          time: msToClock(cp.progress_ms),
        };
      });
    return playing.length > 0 ? playing : null;
  }, [friends]);

  const liveCount = liveFriends?.length ?? LIVE_FALLBACK.length;

  /* ── closest-match card display values (real or placeholder) ── */
  const cmName = closestFriend?.display_name ?? "Ava R.";
  const cmPct = closestFriend?.music_match_percentage ?? 92;
  const cmNow = closestFriend?.currently_playing?.is_playing
    ? closestFriend.currently_playing.track
    : null;
  const sharedGenres = closestMatch?.breakdown.top_shared_genres?.slice(0, 2) ?? ["indie", "lo-fi"];
  const extraShared = closestMatch?.breakdown.shared_genres_count
    ? Math.max(0, closestMatch.breakdown.shared_genres_count - sharedGenres.length)
    : 3;
  const sharedArtists =
    closestMatch?.breakdown.top_shared_artists?.slice(0, 4).map((x) => x.artist_name) ??
    ["Marrow", "Kite Season", "Mona Lin", "The Owls"];

  return (
    <main className="db-page" data-screen-label="Friends">
      {/* head row */}
      <div className="db-head-row">
        <div>
          <div className="db-eyebrow">Who you resonate with</div>
          <h1 className="db-greeting">
            Your circle, <em>in rotation</em>.
          </h1>
        </div>
        <div className="db-seg">
          {SEG_LABELS.map((label, i) => (
            <button key={label} className={segIdx === i ? "active" : ""} onClick={() => setSegIdx(i)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* leaderboard */}
      <section className="db-card" style={{ marginTop: 28 }}>
        <div className="db-card-head">
          <span className="db-lbl">Leaderboard · minutes this week</span>
          <span className="db-more">⋯</span>
        </div>
        <div className="db-lb-grid">
          {/* podium */}
          <div className="db-podium">
            {(podium ?? PODIUM_FALLBACK).map((p) => (
              <div className={`db-pod ${p.cls}`} key={p.cls}>
                <div
                  className={`db-favatar db-pava${("image" in p && p.image) ? "" : " gen"}`}
                  style={
                    "image" in p && p.image
                      ? { backgroundImage: `url(${p.image})` }
                      : ({ "--a": p.a } as React.CSSProperties)
                  }
                />
                <div className="db-pn">{p.name}</div>
                <div className="db-pm">{p.mins} min</div>
                <div className="db-ped">
                  <span className="db-prk">{p.rank}</span>
                </div>
              </div>
            ))}
          </div>
          {/* ranked rows 4–7 */}
          <div className="db-lb-rows">
            {(rows ?? ROWS_FALLBACK).map((r) => (
              <div className="db-lb-row" key={r.rank}>
                <span className="db-lrk">{r.rank}</span>
                <div
                  className={`db-favatar db-lb-av${("image" in r && r.image) ? "" : " gen"}`}
                  style={
                    "image" in r && r.image
                      ? { backgroundImage: `url(${r.image})` }
                      : ({ "--a": r.a } as React.CSSProperties)
                  }
                />
                <div className="db-lb-meta">
                  <div className="db-lb-name">{r.name}</div>
                  <div className="db-lb-bar">
                    <i style={{ width: `${r.bar}%` }} />
                  </div>
                </div>
                <span className="db-lb-mins">{r.mins}</span>
                <Dial pct={r.pct} size={40} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* closest match + listening now */}
      <section className="db-two-up">
        <div className="db-card">
          <div className="db-card-head">
            <span className="db-lbl">Closest match</span>
            <span className="db-live-tag">
              <span className="db-pulse" />
              live
            </span>
          </div>
          <div className="db-cm-row">
            <Dial pct={cmPct} size={104} label="MATCH" />
            <div className="db-cm-info">
              <div className="db-cm-name">{cmName}</div>
              <div className="db-cm-now">
                {cmNow ? (
                  <>
                    <span className="db-eq">
                      <i />
                      <i />
                      <i />
                    </span>{" "}
                    <b>{cmNow.track_name}</b> — {cmNow.artist_name}
                  </>
                ) : (
                  <span style={{ color: "var(--db-ink-faint)" }}>not listening right now</span>
                )}
              </div>
              <div className="db-chips">
                {sharedGenres.map((g) => (
                  <span className="db-chip accent" key={g}>
                    {g}
                  </span>
                ))}
                {extraShared > 0 && <span className="db-chip">+{extraShared} shared</span>}
              </div>
            </div>
          </div>
          <div className="db-cm-shared">
            <div className="db-sh-h">Artists you both love</div>
            <div className="db-chips">
              {sharedArtists.map((a) => (
                <span className="db-chip" key={a}>
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="db-cm-actions">
            <button
              className="db-btn primary"
              onClick={() => setCompareOpen(true)}
              disabled={!closestMatch}
            >
              Compare ▸
            </button>
            <button className="db-btn" onClick={() => setCompareOpen(true)} disabled={!closestMatch}>
              Profile
            </button>
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-head">
            <span className="db-lbl">Listening now</span>
            <span className="db-live-tag">
              <span className="db-pulse" />
              {liveCount} live
            </span>
          </div>
          <div className="db-live-rows">
            {(liveFriends ?? LIVE_FALLBACK).map((f, i) => (
              <div className="db-lv-row" key={`${f.name}-${i}`}>
                <AvRing prog={f.prog} a={f.a} image={"image" in f ? (f.image as string | null) : undefined} />
                <div className="db-lv-meta">
                  <div className="db-lv-n">{f.name}</div>
                  <div className="db-lv-t">{f.track}</div>
                </div>
                <span className="db-lv-time">{f.time}</span>
              </div>
            ))}
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
        <span>{friends?.length ?? 7} friends · v0.4.2</span>
      </div>

      <MatchDetailSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        match={closestMatch ?? null}
        userName={cmName}
      />
    </main>
  );
}
