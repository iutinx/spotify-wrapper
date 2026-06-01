"use client";

import React, { useMemo, useState } from "react";
import { TurntableCarousel, type TurntableTrack } from "@/components/dashboard/turntable";
import {
  useTopTracks,
  useTopArtists,
  useRecentlyPlayed,
  useRollingWindow,
  useUserPlaylists,
  useListeningStats,
} from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useFriends } from "@/hooks/useSocial";

type ApiTimeRange = "short_term" | "medium_term" | "long_term";
type RollingDays = 28 | 90 | 180;

const SEG_LABELS = ["4 WEEKS", "6 MONTHS", "ALL TIME"] as const;
const API_RANGES: ApiTimeRange[] = ["short_term", "medium_term", "long_term"];
const ROLLING_DAYS: RollingDays[] = [28, 90, 180];
const PLAYLIST_COLORS = [10, 80, 150, 220, 300];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes >= 1000) {
    return (totalMinutes / 1000).toFixed(1).replace(/\.0$/, "");
  }
  return totalMinutes.toString();
}

export default function AnalyticsPage() {
  const [segIdx, setSegIdx] = useState(0);
  const { user } = useAuth();

  const timeRange = API_RANGES[segIdx];
  const rollingDays = ROLLING_DAYS[segIdx];

  const { data: tracksData } = useTopTracks(timeRange);
  const { data: artistsData } = useTopArtists(timeRange);
  const { data: recentData } = useRecentlyPlayed();
  const { data: rollingData } = useRollingWindow(rollingDays);
  const { data: playlistsData } = useUserPlaylists();
  const { data: statsData } = useListeningStats();
  const { data: friendsData } = useFriends();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 18) return "afternoon";
    return "evening";
  })();

  const displayName = user?.display_name?.split(" ")[0] || "listener";

  const recentTracks: TurntableTrack[] = useMemo(
    () =>
      recentData?.items?.slice(0, 10).map((item) => ({
        title: item.track_name,
        artist: item.artist_name,
        ago: timeAgo(item.played_at),
        img: item.image_url || undefined,
      })) ?? [
        { title: "Slow Tide", artist: "Marrow", ago: "now" },
        { title: "Amber Hours", artist: "Kite Season", ago: "12 min ago" },
        { title: "Paper Streets", artist: "Lowercase", ago: "38 min ago" },
        { title: "Glasshouse", artist: "V. Mora", ago: "1 hr ago" },
        { title: "Northbound", artist: "Halcyon Bay", ago: "2 hr ago" },
        { title: "Cinder", artist: "The Owls", ago: "3 hr ago" },
        { title: "Quiet Parade", artist: "Field Notes", ago: "yesterday" },
        { title: "Velvet Static", artist: "Mona Lin", ago: "yesterday" },
        { title: "Driftwood", artist: "Sea Cabin", ago: "2 days ago" },
        { title: "Last Train", artist: "Echo & Ivy", ago: "2 days ago" },
      ],
    [recentData?.items],
  );

  const topTracks = tracksData?.tracks?.slice(0, 4) ?? [];
  const topArtists = artistsData?.artists?.slice(0, 4) ?? [];

  const topGenres = useMemo(() => {
    const genres = rollingData?.top_genres?.slice(0, 5).map((g) => g.genre);
    if (genres && genres.length > 0) return genres;
    const fallback = statsData?.top_genres?.slice(0, 5).map((g) => g.genre);
    if (fallback && fallback.length > 0) return fallback;
    return ["indie", "lo-fi", "jazz", "neo-soul", "ambient"];
  }, [rollingData?.top_genres, statsData?.top_genres]);

  const clockHours = useMemo(() => {
    if (!recentData?.items || recentData.items.length === 0) {
      return [4, 3, 2, 2, 3, 5, 9, 14, 20, 26, 30, 28, 34, 30, 26, 30, 38, 46, 60, 78, 92, 99, 72, 40];
    }
    const buckets = new Array(24).fill(0);
    recentData.items.forEach((item) => {
      const hour = new Date(item.played_at).getHours();
      buckets[hour]++;
    });
    return buckets;
  }, [recentData?.items]);

  const clockMax = Math.max(...clockHours, 1);

  const minutesListened = statsData ? statsData.total_hours_listened * 60 : 0;
  const currentStreak = statsData?.listening_streak ?? 0;

  const newDiscoveriesCount = rollingData?.new_discoveries_count ?? 0;

  const newDiscoveryCovers = useMemo(() => {
    if (newDiscoveriesCount === 0) return null;
    const tracks = rollingData?.top_tracks?.slice(0, 4) ?? [];
    if (tracks.length > 0) return tracks;
    return null;
  }, [rollingData?.top_tracks, newDiscoveriesCount]);

  const newThisPeriodItems = useMemo(() => {
    if (recentData?.items && recentData.items.length >= 2) {
      return recentData.items.slice(-2);
    }
    return [
      { track_name: "Glasshouse", artist_name: "V. Mora", image_url: null },
      { track_name: "Cinder", artist_name: "The Owls", image_url: null },
    ];
  }, [recentData?.items]);

  const friendsListeningItems = useMemo(() => {
    if (!friendsData || friendsData.length === 0) return null;
    return friendsData.slice(0, 3).map((friend) => {
      const currentlyPlaying = (friend as any).currently_playing;
      const trackInfo = currentlyPlaying?.track
        ? `${currentlyPlaying.track.track_name ?? "Unknown"} — ${currentlyPlaying.track.artist_name ?? "Unknown"}`
        : "not listening";
      const tag = currentlyPlaying?.is_playing ? "live ●" : "offline";
      return {
        name: friend.display_name || "Friend",
        track: trackInfo,
        tag,
        a: `${Math.floor(Math.random() * 360)}deg`,
        image: friend.profile_image_url,
      };
    });
  }, [friendsData]);

  return (
    <main className="db-page">
      {/* head row */}
      <div className="db-head-row">
        <div>
          <div className="db-eyebrow">Your listening, decoded</div>
          <h1 className="db-greeting">
            Good {greeting}, <em>{displayName}.</em>
          </h1>
        </div>
        <div className="db-seg">
          {SEG_LABELS.map((label, i) => (
            <button
              key={label}
              className={segIdx === i ? "active" : ""}
              onClick={() => setSegIdx(i)}
            >
              {label}
            </button>
          ))}
        </div>

      </div>

      {/* hero: stats · turntable · genres */}
      <section className="db-hero">
        {/* left stats */}
        <div className="db-hero-side">
          <div className="db-card">
            <div className="db-card-head">
              <span className="db-lbl">Minutes listened</span>
            </div>
            <div className="db-stat">
              {minutesListened.toLocaleString()}
            </div>
            <div className="db-stat-cap">
              {minutesListened > 0 ? `${Math.round(minutesListened / 60)} hours total` : "0 minutes total"}
            </div>
          </div>
          <div className="db-card">
            <div className="db-card-head">
              <span className="db-lbl">Current streak</span>
            </div>
            <div className="db-stat">
              {currentStreak}<small> days</small>
            </div>
            <div className="db-stat-cap">
              {currentStreak > 0 ? "listened every day" : "start listening to build a streak"}
            </div>
          </div>
        </div>

        {/* turntable */}
        <div>
          <div
            className="db-card-head"
            style={{ justifyContent: "center", marginBottom: 6 }}
          >
            <span
              className="db-lbl"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--db-spotify)",
                  display: "inline-block",
                }}
              />
              Last listened
            </span>
          </div>
          <TurntableCarousel tracks={recentTracks} size={440} tilt={0.35} />
          <div className="db-tt-hint">drag to spin · ‹ › step · throw for momentum</div>
        </div>

        {/* right: genres + new */}
        <div className="db-hero-side">
          <div className="db-card">
            <div className="db-card-head">
              <span className="db-lbl">Top genres</span>
              <span className="db-more">⌄</span>
            </div>
            <div className="db-chips">
              {topGenres.map((g, i) => (
                <span key={g} className={`db-chip${i === 0 ? " on" : ""}`}>
                  {g}
                </span>
              ))}
            </div>
          </div>
          <div className="db-card">
            <div className="db-card-head">
              <span className="db-lbl">New this period</span>
            </div>
            <div className="db-rows">
              {newThisPeriodItems.map((item, i) => (
                <div className="db-row" key={i}>
                  <div
                    className="db-cover-sq"
                    style={
                      item.image_url
                        ? ({
                            backgroundImage: `url(${item.image_url})`,
                            backgroundSize: "cover",
                          } as React.CSSProperties)
                        : ({ "--h": String((i * 176 + 14) % 360) } as React.CSSProperties)
                    }
                  />
                  <div className="db-row-meta">
                    <div className="db-t1">{item.track_name}</div>
                    <div className="db-t2">{item.artist_name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* module grid */}
      <section className="db-modules">
        {/* top songs */}
        <div className="db-card db-m-songs">
          <div className="db-card-head">
            <span className="db-lbl">Top songs</span>

          </div>
          <div className="db-rows">
            {topTracks.length > 0
              ? topTracks.map((t, i) => (
                  <div className="db-row" key={t.spotify_track_id}>
                    <span className="db-rk">{t.rank}</span>
                    <div
                      className="db-cover-sq"
                      style={
                        t.image_url
                          ? ({
                              backgroundImage: `url(${t.image_url})`,
                              backgroundSize: "cover",
                            } as React.CSSProperties)
                          : ({ "--h": String((i * 54 + 8) % 360) } as React.CSSProperties)
                      }
                    />
                    <div className="db-row-meta">
                      <div className="db-t1">{t.track_name}</div>
                      <div className="db-t2">{t.artist_name}</div>
                    </div>
                  </div>
                ))
              : [
                  { rank: 1, title: "Slow Tide", artist: "Marrow", h: 8 },
                  { rank: 2, title: "Amber Hours", artist: "Kite Season", h: 54 },
                  { rank: 3, title: "Paper Streets", artist: "Lowercase", h: 150 },
                  { rank: 4, title: "Northbound", artist: "Halcyon Bay", h: 265 },
                ].map((t) => (
                  <div className="db-row" key={t.rank}>
                    <span className="db-rk">{t.rank}</span>
                    <div
                      className="db-cover-sq"
                      style={{ "--h": String(t.h) } as React.CSSProperties}
                    />
                    <div className="db-row-meta">
                      <div className="db-t1">{t.title}</div>
                      <div className="db-t2">{t.artist}</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* top artists */}
        <div className="db-card db-m-artists">
          <div className="db-card-head">
            <span className="db-lbl">Top artists</span>
            <span className="db-more">⋯</span>
          </div>
          <div className="db-rows">
            {topArtists.length > 0
              ? topArtists.map((a, i) => (
                  <div className="db-row" key={a.spotify_artist_id}>
                    <span className="db-rk">{a.rank}</span>
                    <div
                      className="db-cover-sq db-avatar-rd"
                      style={
                        a.image_url
                          ? ({
                              backgroundImage: `url(${a.image_url})`,
                              backgroundSize: "cover",
                            } as React.CSSProperties)
                          : ({ "--h": String((i * 100 + 20) % 360) } as React.CSSProperties)
                      }
                    />
                    <div className="db-row-meta">
                      <div className="db-t1">{a.artist_name}</div>
                      <div className="db-t2">{a.genres.slice(0, 2).join(", ")}</div>
                    </div>
                  </div>
                ))
              : [
                  { rank: 1, name: "Marrow", sub: "2,140 plays", h: 20 },
                  { rank: 2, name: "Kite Season", sub: "1,602 plays", h: 120 },
                  { rank: 3, name: "Mona Lin", sub: "1,338 plays", h: 230 },
                  { rank: 4, name: "The Owls", sub: "1,041 plays", h: 320 },
                ].map((a) => (
                  <div className="db-row" key={a.rank}>
                    <span className="db-rk">{a.rank}</span>
                    <div
                      className="db-cover-sq db-avatar-rd"
                      style={{ "--h": String(a.h) } as React.CSSProperties}
                    />
                    <div className="db-row-meta">
                      <div className="db-t1">{a.name}</div>
                      <div className="db-t2">{a.sub}</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* listening clock */}
        <div className="db-card db-m-clock">
          <div className="db-card-head">
            <span className="db-lbl">Listening clock</span>
            <span className="db-val">
              {recentData?.items && recentData.items.length > 0
                ? `based on ${recentData.items.length} recent plays`
                : "peak 9–11pm"}
            </span>
          </div>
          <div className="db-clock">
            {clockHours.map((v, i) => (
              <span
                key={i}
                className="db-clock-bar"
                style={{ height: `${Math.round((v / clockMax) * 100)}%` }}
              />
            ))}
          </div>
          <div className="db-clock-axis">
            <span>12a</span>
            <span>6a</span>
            <span>12p</span>
            <span>6p</span>
            <span>11p</span>
          </div>
        </div>

        {/* mood */}
        <div className="db-card db-m-mood">
          <div className="db-card-head">
            <span className="db-lbl">Mood</span>
          </div>
          <div className="db-rows">
            {[
              { label: "Energy", pct: 68, color: "var(--db-spotify)" },
              { label: "Valence", pct: 54, color: "var(--db-ink)" },
              { label: "Tempo", pct: 42, color: "var(--db-ink-soft)" },
            ].map(({ label, pct, color }) => (
              <div className="db-mood-row" key={label}>
                <span className="db-mood-label">{label}</span>
                <div className="db-mood-track">
                  <div
                    className="db-mood-fill"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* friends */}
        <div className="db-card db-m-friends">
          <div className="db-card-head">
            <span className="db-lbl">Friends · listening now</span>
            <span className="db-more">⋯</span>
          </div>
          <div className="db-friends-list">
            {friendsListeningItems ? (
              friendsListeningItems.map((friend) => (
                <div className="db-friend" key={friend.name}>
                  <div
                    className="db-fava"
                    style={{
                      ...(friend.image ? { backgroundImage: `url(${friend.image})`, backgroundSize: "cover" } : { "--a": friend.a } as React.CSSProperties),
                    }}
                  />
                  <div className="db-fmeta">
                    <div className="db-fn">{friend.name}</div>
                    <div className="db-fs">{friend.track}</div>
                  </div>
                  <span className="db-ftag">{friend.tag}</span>
                </div>
              ))
            ) : (
              <div className="db-friends-empty">
                <div className="db-t2">No friends yet</div>
                <div className="db-t2" style={{ fontSize: 12, opacity: 0.6 }}>
                  add friends to see what they&apos;re listening to
                </div>
              </div>
            )}
          </div>
        </div>

        {/* new discoveries */}
        <div className="db-card db-m-finds">
          <div className="db-card-head">
            <span className="db-lbl">New discoveries</span>
          </div>
          <div className="db-finds-big">{newDiscoveriesCount}</div>
          <div className="db-stat-cap">
            {newDiscoveriesCount > 0 ? "fresh tracks this period" : "tracks you haven't heard before"}
          </div>
          {newDiscoveryCovers && (
            <div className="db-finds-row">
              {newDiscoveryCovers.map((track) => (
                <div
                  key={track.spotify_track_id}
                  className="db-finds-cv"
                  title={`${track.track_name} — ${track.artist_name}`}
                  style={
                    track.image_url
                      ? ({
                          backgroundImage: `url(${track.image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        } as React.CSSProperties)
                      : ({ "--h": String(Math.random() * 360) } as React.CSSProperties)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* playlists */}
        <div className="db-card db-m-playlists">
          <div className="db-card-head">
            <span className="db-lbl">Your playlists</span>
            <span className="db-more">⋯</span>
          </div>
          <div className="db-pl-row">
            {(playlistsData?.items?.slice(0, 5) ?? []).map((pl) => (
              <div className="db-pl" key={pl.spotify_playlist_id}>
                <div
                  className="db-pl-cover"
                  style={
                    pl.image_url
                      ? ({
                          backgroundImage: `url(${pl.image_url})`,
                          backgroundSize: "cover",
                        } as React.CSSProperties)
                      : ({ "--h": String((pl.tracks_total * 37) % 360) } as React.CSSProperties)
                  }
                />
                <div className="db-pl-title">{pl.name}</div>
                <div className="db-pl-sub">{pl.tracks_total} tracks</div>
              </div>
            ))}
            {(!playlistsData?.items || playlistsData.items.length === 0) &&
              [
                { title: "Late Night", tracks: 48, h: PLAYLIST_COLORS[0] },
                { title: "Focus Deep", tracks: 120, h: PLAYLIST_COLORS[1] },
                { title: "Morning Run", tracks: 32, h: PLAYLIST_COLORS[2] },
                { title: "Rainy Sunday", tracks: 64, h: PLAYLIST_COLORS[3] },
                { title: "Discover Weekly", tracks: 30, h: PLAYLIST_COLORS[4] },
              ].map(({ title, tracks, h }) => (
                <div className="db-pl" key={title}>
                  <div
                    className="db-pl-cover"
                    style={{ "--h": String(h) } as React.CSSProperties}
                  />
                  <div className="db-pl-title">{title}</div>
                  <div className="db-pl-sub">{tracks} tracks</div>
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
        <span>v0.4.2 · build 1142</span>
      </div>
    </main>
  );
}
