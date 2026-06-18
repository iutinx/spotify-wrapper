"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useFriends } from "@/hooks/useSocial";
import { useWebSocket } from "@/hooks/useWebSocket";
import { MatchDetailSheet } from "@/components/social/match-detail";
import { angleFor, msToClock } from "@/lib/utils";
import type { Friend, LeaderboardEntry, MusicMatch } from "@/types";

const SEG_LABELS = ["THIS WEEK", "6 MONTHS", "ALL TIME"] as const;

/* format a minute count as "8.4k" / "920" */
function formatMins(totalMinutes: number): string {
  if (totalMinutes >= 1000) {
    return (totalMinutes / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return Math.round(totalMinutes).toString();
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


export default function FriendsPage() {
  const { user: currentUser } = useAuth();
  const [segIdx, setSegIdx] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: friends } = useFriends();

  const { liveUsers } = useWebSocket();

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
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

  /* ── friends listening live right now (driven by WebSocket activity_update) ── */
  const liveFriends = useMemo(() => {
    if (!friends) return null;
    const result: { name: string; track: string; image: string | null; a: string; prog: number; time: string }[] = [];
    liveUsers.forEach((wsEntry, userId) => {
      const friend = friends.find((f) => f.user_id === userId);
      if (!friend || !wsEntry.track.is_playing) return;
      const dur = wsEntry.track.duration_ms || 0;
      const prog = dur > 0 ? Math.min(100, Math.round(((wsEntry.track.progress_ms ?? 0) / dur) * 100)) : 0;
      result.push({
        name: friend.display_name,
        track: `${wsEntry.track.track_name} — ${wsEntry.track.artist_name ?? "Unknown"}`,
        image: friend.profile_image_url,
        a: angleFor(friend.user_id),
        prog,
        time: msToClock(wsEntry.track.progress_ms ?? 0),
      });
    });
    return result.length > 0 ? result : null;
  }, [friends, liveUsers]);

  const liveCount = liveFriends?.length ?? 0;

  /* ── closest-match card display values ── */
  const cmName = closestFriend?.display_name ?? null;
  const cmPct = closestFriend?.music_match_percentage ?? 0;
  const cmNow = closestFriend?.currently_playing?.is_playing
    ? closestFriend.currently_playing.track
    : null;
  const sharedGenres = closestMatch?.breakdown.top_shared_genres?.slice(0, 2) ?? [];
  const extraShared = closestMatch?.breakdown.shared_genres_count
    ? Math.max(0, closestMatch.breakdown.shared_genres_count - sharedGenres.length)
    : 0;
  const sharedArtists =
    closestMatch?.breakdown.top_shared_artists?.slice(0, 4).map((x) => x.artist_name) ?? [];

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
          <span className="db-lbl">
            Leaderboard · minutes{segIdx !== 2 && <> · <span style={{ opacity: 0.5, fontSize: 11 }}>all-time</span></>}
          </span>
          <span className="db-more">⋯</span>
        </div>
        <div className="db-lb-grid">
          {leaderboardLoading ? (
            <>
              <div className="db-podium">
                {(["p2", "p1", "p3"] as const).map((cls) => (
                  <div className={`db-pod ${cls}`} key={cls}>
                    <div className="db-favatar db-pava gen" style={{ "--a": "120deg" } as React.CSSProperties} />
                    <div className="db-pn" style={{ opacity: 0.3, background: "var(--db-hair)", borderRadius: 4, height: 14, width: 60 }} />
                    <div className="db-pm" style={{ opacity: 0.2, background: "var(--db-hair)", borderRadius: 4, height: 11, width: 40, marginTop: 4 }} />
                    <div className="db-ped"><span className="db-prk">·</span></div>
                  </div>
                ))}
              </div>
              <div className="db-lb-rows">
                {[4, 5, 6, 7].map((rank) => (
                  <div className="db-lb-row" key={rank} style={{ opacity: 0.4 }}>
                    <span className="db-lrk">{rank}</span>
                    <div className="db-favatar db-lb-av gen" style={{ "--a": "180deg" } as React.CSSProperties} />
                    <div className="db-lb-meta">
                      <div className="db-lb-name" style={{ background: "var(--db-hair)", borderRadius: 4, height: 13, width: 80 }} />
                      <div className="db-lb-bar"><i style={{ width: "40%" }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : lbEntries.length < 3 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "32px 0", color: "var(--db-ink-faint)", fontSize: 13 }}>
              <div style={{ marginBottom: 6 }}>Not enough data yet</div>
              <div style={{ fontSize: 11 }}>Invite friends to build your leaderboard.</div>
            </div>
          ) : (
            <>
              <div className="db-podium">
                {podium!.map((p) => (
                  <div className={`db-pod ${p.cls}`} key={p.cls}>
                    <div
                      className={`db-favatar db-pava${p.image ? "" : " gen"}`}
                      style={p.image ? { backgroundImage: `url(${p.image})` } : ({ "--a": p.a } as React.CSSProperties)}
                    />
                    <div className="db-pn">{p.name}</div>
                    <div className="db-pm">{p.mins} min</div>
                    <div className="db-ped"><span className="db-prk">{p.rank}</span></div>
                  </div>
                ))}
              </div>
              {rows && (
                <div className="db-lb-rows">
                  {rows.map((r) => (
                    <div className="db-lb-row" key={r.rank}>
                      <span className="db-lrk">{r.rank}</span>
                      <div
                        className={`db-favatar db-lb-av${r.image ? "" : " gen"}`}
                        style={r.image ? { backgroundImage: `url(${r.image})` } : ({ "--a": r.a } as React.CSSProperties)}
                      />
                      <div className="db-lb-meta">
                        <div className="db-lb-name">{r.name}</div>
                        <div className="db-lb-bar"><i style={{ width: `${r.bar}%` }} /></div>
                      </div>
                      <span className="db-lb-mins">{r.mins}</span>
                      <Dial pct={r.pct} size={40} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
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
          {!closestFriend ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--db-ink-faint)", fontSize: 13 }}>
              <div style={{ marginBottom: 6 }}>No friends added yet</div>
              <div style={{ fontSize: 11 }}>Add friends to see your closest music match.</div>
            </div>
          ) : (
            <>
              <div className="db-cm-row">
                <Dial pct={cmPct} size={104} label="MATCH" />
                <div className="db-cm-info">
                  <div className="db-cm-name">{cmName}</div>
                  <div className="db-cm-now">
                    {cmNow ? (
                      <>
                        <span className="db-eq"><i /><i /><i /></span>{" "}
                        <b>{cmNow.track_name}</b> — {cmNow.artist_name}
                      </>
                    ) : (
                      <span style={{ color: "var(--db-ink-faint)" }}>not listening right now</span>
                    )}
                  </div>
                  <div className="db-chips">
                    {sharedGenres.map((g) => (
                      <span className="db-chip accent" key={g}>{g}</span>
                    ))}
                    {extraShared > 0 && <span className="db-chip">+{extraShared} shared</span>}
                  </div>
                </div>
              </div>
              {sharedArtists.length > 0 && (
                <div className="db-cm-shared">
                  <div className="db-sh-h">Artists you both love</div>
                  <div className="db-chips">
                    {sharedArtists.map((a) => (
                      <span className="db-chip" key={a}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="db-cm-actions">
                <button className="db-btn primary" onClick={() => setCompareOpen(true)} disabled={!closestMatch}>
                  Compare ▸
                </button>
                <button className="db-btn" onClick={() => setCompareOpen(true)} disabled={!closestMatch}>
                  Profile
                </button>
              </div>
            </>
          )}
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
            {liveFriends?.length ? (
              liveFriends.map((f, i) => (
                <div className="db-lv-row" key={`${f.name}-${i}`}>
                  <AvRing prog={f.prog} a={f.a} image={f.image} />
                  <div className="db-lv-meta">
                    <div className="db-lv-n">{f.name}</div>
                    <div className="db-lv-t">{f.track}</div>
                  </div>
                  <span className="db-lv-time">{f.time}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--db-ink-faint)", fontSize: 13 }}>
                None of your friends are listening right now.
              </div>
            )}
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
        <span>{friends?.length ?? 0} friends · v0.4.2</span>
      </div>

      <MatchDetailSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        match={closestMatch ?? null}
        userName={cmName ?? ""}
      />
    </main>
  );
}
