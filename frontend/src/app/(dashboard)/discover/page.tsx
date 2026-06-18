"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { useFriends, useSendFriendRequest, useSearchUsers } from "@/hooks/useSocial";
import { useWebSocket } from "@/hooks/useWebSocket";
import { angleFor, msToClock } from "@/lib/utils";
import type { SearchUser } from "@/types";

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

/* ── generative gradient avatar ── */
function Fava({ size, a, className, image }: { size: number; a: string; className?: string; image?: string | null }) {
  if (image) {
    return (
      <div
        className={`db-fava${className ? " " + className : ""}`}
        style={{ width: size, height: size, backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" } as React.CSSProperties}
      />
    );
  }
  return (
    <div
      className={`db-fava${className ? " " + className : ""}`}
      style={{ width: size, height: size, ["--a" as string]: a } as React.CSSProperties}
    />
  );
}

const VIBES: { label: string; accent?: boolean }[] = [
  { label: "indie", accent: true },
  { label: "lo-fi", accent: true },
  { label: "jazz" },
  { label: "neo-soul" },
  { label: "ambient" },
  { label: "folk" },
  { label: "hyperpop" },
  { label: "shoegaze" },
  { label: "bedroom-pop" },
  { label: "slowcore" },
  { label: "dream-pop" },
];

/* genre options — base set is always shown, extras reveal on "+ N more" */
const BASE_GENRES = ["Indie", "Lo-fi", "Jazz", "Ambient"];
const EXTRA_GENRES = ["Folk", "Neo-soul", "Shoegaze", "Dream-pop", "Hyperpop", "Bedroom-pop", "Slowcore"];

/* sidebar filter groups (cosmetic — backend search doesn't support server-side filtering yet) */
const FILTER_GROUPS = [
  { title: "Connection", opts: ["Friends of friends", "Strangers", "Already followed"] },
  { title: "Genres", opts: BASE_GENRES },
  { title: "Activity", opts: ["Listening now", "Active this week", "Any time"] },
];

const DEFAULT_RANGE = { min: 60, max: 95 };
const SORTS = ["MATCH", "RECENT", "A–Z"] as const;

export default function DiscoverPage() {
  const { toast } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const openProfile = (userId: string) => router.push(`/discover/${userId}`);

  const [query, setQuery] = useState("");
  const [sortIdx, setSortIdx] = useState(0);
  const [activeOpts, setActiveOpts] = useState<Set<string>>(new Set());
  const toggleOpt = (key: string) =>
    setActiveOpts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const [matchRange, setMatchRange] = useState(DEFAULT_RANGE);
  const [genresOpen, setGenresOpen] = useState(false);

  const resetFilters = () => {
    setActiveOpts(new Set());
    setMatchRange(DEFAULT_RANGE);
    toast("Filters reset");
  };

  const hasQuery = query.trim().length > 0;

  /* ── real data hooks ── */
  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: searchResults, isLoading: searching } = useSearchUsers(query);
  const { mutate: sendRequest } = useSendFriendRequest();
  const { liveUsers } = useWebSocket();

  /* ── taste twins: friends sorted by match % ── */
  const tasteTwins = useMemo(
    () => (friends ?? []).sort((a, b) => b.music_match_percentage - a.music_match_percentage).slice(0, 12),
    [friends],
  );

  /* ── live pulse: public users broadcasting activity via WebSocket ── */
  const pulseList = useMemo(
    () => Array.from(liveUsers.values()).filter((u) => u.track.is_playing && u.track.track_name),
    [liveUsers],
  );

  /* ── search results with client-side sort ── */
  const visible = useMemo(() => {
    const results = searchResults ?? [];
    const sorted = [...results];
    if (sortIdx === 2) sorted.sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
    return sorted;
  }, [searchResults, sortIdx]);

  const resCount = visible.length;
  const pin = visible[0] ?? null;
  const rows = visible.slice(1);

  /* match-score slider */
  const GAP = 5;
  const pctFromEvent = (clientX: number) => {
    const tk = trackRef.current;
    if (!tk) return null;
    const rect = tk.getBoundingClientRect();
    return Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  };
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const pct = pctFromEvent(e.clientX);
    if (pct === null) return;
    const thumb: "min" | "max" =
      Math.abs(pct - matchRange.min) <= Math.abs(pct - matchRange.max) ? "min" : "max";
    const apply = (p: number) =>
      setMatchRange((r) =>
        thumb === "min"
          ? { ...r, min: Math.min(p, r.max - GAP) }
          : { ...r, max: Math.max(p, r.min + GAP) },
      );
    apply(pct);
    const move = (ev: PointerEvent) => {
      const p = pctFromEvent(ev.clientX);
      if (p !== null) apply(p);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const runQuery = (q: string) => {
    setQuery(q);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const top = (inputRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="db-page" data-screen-label="Discover">
      {/* head row */}
      <div className="db-head-row">
        <div>
          <div className="db-eyebrow">Discover</div>
          <h1 className="db-greeting">
            Find your <em>people</em>.
          </h1>
        </div>
      </div>

      {/* ───────────── SEARCH ───────────── */}
      <div className="db-search-shell">
        <div className={`db-searchbar${hasQuery ? " has-q" : ""}`}>
          <svg className="db-mag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder={"Search by name or handle…"}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="db-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
          <span className="db-kbd">⌘ K</span>
        </div>

        {!hasQuery && (
          <div className="db-sug-row">
            <span className="db-sl">Try</span>
            {VIBES.slice(0, 5).map((v) => (
              <button key={v.label} className="db-chip ghost" onClick={() => runQuery(v.label)}>
                {v.label}
              </button>
            ))}
          </div>
        )}

        {hasQuery && (
          <div className="db-filter-row">
            <span className="db-sl">Sort</span>
            {SORTS.map((s, i) => (
              <button
                key={s}
                className={`db-chip${sortIdx === i ? " accent" : " ghost"}`}
                onClick={() => setSortIdx(i)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════ EMPTY STATE — discovery rails ═══════════ */}
      {!hasQuery && (
        <div className="db-empty-shell">
          {/* TASTE TWINS */}
          <section className="db-card">
            <div className="db-card-head">
              <div className="db-h-title">
                Taste twins <em>— people whose listening looks like yours</em>
              </div>
            </div>
            <div className="db-tt-scroll">
              {friendsLoading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="db-card db-pcard" style={{ opacity: 0.4 }}>
                    <Fava size={64} a={`${i * 80}deg`} />
                    <div style={{ height: 13, width: 70, background: "var(--db-hair)", borderRadius: 4, marginTop: 6 }} />
                    <div style={{ height: 11, width: 50, background: "var(--db-hair)", borderRadius: 4, marginTop: 4 }} />
                  </div>
                ))
              ) : tasteTwins.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--db-ink-faint)", fontSize: 13, minWidth: 220 }}>
                  <div style={{ marginBottom: 6 }}>No taste twins yet</div>
                  <div style={{ fontSize: 11 }}>Add friends to see who shares your listening style.</div>
                </div>
              ) : (
                tasteTwins.map((f) => (
                  <div
                    key={f.user_id}
                    className="db-card db-pcard"
                    role="button"
                    tabIndex={0}
                    onClick={() => openProfile(f.user_id)}
                  >
                    <span className="db-pc-corner">
                      <Dial pct={f.music_match_percentage} size={38} />
                    </span>
                    <Fava size={64} a={angleFor(f.user_id)} image={f.profile_image_url} />
                    <div>
                      <div className="db-pc-name">{f.display_name}</div>
                      <div className="db-pc-handle">{f.music_match_percentage}% match</div>
                    </div>
                    <div className="db-pc-why">{f.music_match_percentage}% music match</div>
                    <div className="db-pc-acts">
                      <button
                        className="db-btn primary sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          sendRequest(f.user_id, {
                            onSuccess: () => toast(`Friend request sent to ${f.display_name}`),
                            onError: () => toast("Already friends or request pending"),
                          });
                        }}
                      >
                        Connect
                      </button>
                      <button
                        className="db-btn sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProfile(f.user_id);
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* FRIENDS-OF-FRIENDS + LIVE PULSE */}
          <section className="db-two-up">
            <div className="db-card">
              <div className="db-card-head">
                <div className="db-h-title">
                  Through your friends <em>— mutuals you don&apos;t follow yet</em>
                </div>
              </div>
              <div className="db-fof-scroll">
                <div style={{ padding: "24px 0", textAlign: "center", color: "var(--db-ink-faint)", fontSize: 13 }}>
                  <div style={{ marginBottom: 6 }}>No mutual suggestions yet</div>
                  <div style={{ fontSize: 11 }}>Add more friends to discover who they follow.</div>
                </div>
              </div>
            </div>

            <div className="db-card">
              <div className="db-card-head">
                <div className="db-h-title">Pulse</div>
                <span className="db-live-tag">
                  <span className="db-pulse" />
                  {pulseList.length} live
                </span>
              </div>
              <div className="db-prows">
                {pulseList.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--db-ink-faint)", fontSize: 12 }}>
                    No one is listening publicly right now.
                  </div>
                ) : (
                  pulseList.map((u, i) => (
                    <div className="db-prow" key={`${u.user_id}-${i}`}>
                      <Fava size={32} a={angleFor(u.user_id)} image={u.profile_image_url} />
                      <div className="db-prow-meta">
                        <div className="db-prow-n">{u.display_name ?? "Unknown"}</div>
                        <div className="db-prow-t">{u.track.track_name} — {u.track.artist_name ?? "Unknown"}</div>
                      </div>
                      <span className="db-prow-time">{msToClock(u.track.progress_ms ?? 0)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* BROWSE BY VIBE */}
          <section className="db-card">
            <div className="db-card-head">
              <div className="db-h-title">
                Browse by vibe <em>— tap a tag, see who lives in it</em>
              </div>
            </div>
            <div className="db-vibe-list">
              {VIBES.map((v) => (
                <button key={v.label} className={`db-chip${v.accent ? " accent" : ""}`} onClick={() => runQuery(v.label)}>
                  {v.label}
                </button>
              ))}
              <button className="db-chip ghost" onClick={() => toast("More vibes coming soon")}>
                + more
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════ RESULTS STATE ═══════════ */}
      {hasQuery && (
        <div className="db-results-shell">
          {/* FILTER SIDEBAR */}
          <aside className="db-card db-filter-card">
            <div className="db-fc-head">
              <span className="db-lbl">Refine</span>
              <button className="db-see" onClick={resetFilters}>
                reset
              </button>
            </div>

            <div className="db-fgroup">
              <div className="db-ft">Match score</div>
              <div className="db-fslider">
                <div
                  className="db-fsl-tk"
                  ref={trackRef}
                  role="group"
                  aria-label="Match score range"
                  onPointerDown={startDrag}
                >
                  <div
                    className="db-fsl-fill"
                    style={{ left: `${matchRange.min}%`, right: `${100 - matchRange.max}%` }}
                  />
                  <span className="db-fsl-h h1" style={{ left: `${matchRange.min}%` }} aria-hidden="true" />
                  <span className="db-fsl-h h2" style={{ left: `${matchRange.max}%` }} aria-hidden="true" />
                </div>
                <div className="db-fsl-vv">
                  <span>{matchRange.min}%</span>
                  <span>{matchRange.max}%</span>
                </div>
              </div>
            </div>

            {FILTER_GROUPS.map((g) => {
              const isGenres = g.title === "Genres";
              const opts = isGenres && genresOpen ? [...g.opts, ...EXTRA_GENRES] : g.opts;
              return (
                <div className="db-fgroup" key={g.title}>
                  <div className="db-ft">{g.title}</div>
                  {opts.map((o) => {
                    const key = `${g.title}:${o}`;
                    return (
                      <button
                        key={o}
                        className={`db-fopt${activeOpts.has(key) ? " on" : ""}`}
                        onClick={() => toggleOpt(key)}
                      >
                        <span className="db-cb" />
                        {o}
                      </button>
                    );
                  })}
                  {isGenres && (
                    <button
                      className="db-see"
                      style={{ marginTop: 6 }}
                      onClick={() => setGenresOpen((v) => !v)}
                    >
                      {genresOpen ? "show less" : `+ ${EXTRA_GENRES.length} more`}
                    </button>
                  )}
                </div>
              );
            })}
          </aside>

          {/* RESULTS COLUMN */}
          <div className="db-results-main">
            <div className="db-results-head">
              <div className="db-res-count">
                {searching ? (
                  <span style={{ color: "var(--db-ink-faint)" }}>Searching…</span>
                ) : (
                  <>
                    <b>{resCount}</b> people match{" "}
                    <span>
                      "
                      <i style={{ fontFamily: "var(--font-serif), serif", color: "var(--db-ink)" }}>{query}</i>
                      "
                    </span>
                  </>
                )}
              </div>
              <div className="db-seg">
                {SORTS.map((s, i) => (
                  <button key={s} className={sortIdx === i ? "active" : ""} onClick={() => setSortIdx(i)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {searching ? (
              <div className="db-card db-result-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="db-res" style={{ opacity: 0.4 }}>
                    <Fava size={44} a={`${i * 120}deg`} />
                    <div>
                      <div style={{ height: 14, width: 100, background: "var(--db-hair)", borderRadius: 4, marginBottom: 6 }} />
                      <div style={{ height: 11, width: 140, background: "var(--db-hair)", borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : pin ? (
              <>
                {/* pinned top match */}
                <div className="db-pin" role="button" tabIndex={0} onClick={() => openProfile(pin.id)}>
                  <span className="db-pin-tag">top result</span>
                  <Fava size={84} a={angleFor(pin.id)} image={pin.profile_image_url} />
                  <div className="db-pin-info">
                    <div className="db-pin-name">{pin.display_name}</div>
                    <div className="db-pin-handle">
                      {pin.bio ?? `listener on Resonance`}
                    </div>
                    {pin.favorite_genres && pin.favorite_genres.length > 0 && (
                      <div className="db-pin-why">
                        {pin.favorite_genres.slice(0, 3).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="db-pin-acts">
                    <button
                      className="db-btn primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        sendRequest(pin.id, {
                          onSuccess: () => toast(`Friend request sent to ${pin.display_name}`),
                          onError: () => toast("Already friends or request pending"),
                        });
                      }}
                    >
                      + Connect
                    </button>
                    <button
                      className="db-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProfile(pin.id);
                      }}
                    >
                      View profile
                    </button>
                  </div>
                </div>

                {/* ordinary results */}
                {rows.length > 0 && (
                  <div className="db-card db-result-list">
                    {rows.map((r) => (
                      <div key={r.id} className="db-res" role="button" tabIndex={0} onClick={() => openProfile(r.id)}>
                        <Fava size={44} a={angleFor(r.id)} image={r.profile_image_url} />
                        <div>
                          <div className="db-res-name">{r.display_name}</div>
                          <div className="db-res-handle">
                            {r.bio ?? "listener on Resonance"}
                          </div>
                          {r.favorite_genres && r.favorite_genres.length > 0 && (
                            <div className="db-res-why">{r.favorite_genres.slice(0, 2).join(" · ")}</div>
                          )}
                        </div>
                        <div className="db-res-acts">
                          <button
                            className="db-btn primary sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendRequest(r.id, {
                                onSuccess: () => toast(`Friend request sent to ${r.display_name}`),
                                onError: () => toast("Already friends or request pending"),
                              });
                            }}
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="db-card db-no-results">
                <div className="db-nr-title">No people match &ldquo;{query}&rdquo;</div>
                <div className="db-nr-sub">Try a different name or handle.</div>
                <button className="db-btn primary sm" onClick={() => setQuery("")}>
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* footer */}
      <div className="db-footer">
        <span>© Resonance 2026</span>
        <span className="db-footer-live">
          <span className="db-pulse" />
          Synced with Spotify · 2 min ago
        </span>
        <span>discover · v0.4.2</span>
      </div>
    </main>
  );
}
