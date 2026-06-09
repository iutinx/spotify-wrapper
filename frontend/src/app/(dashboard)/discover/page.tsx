"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";

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
function Fava({ size, a, className }: { size: number; a: string; className?: string }) {
  return (
    <div
      className={`db-fava${className ? " " + className : ""}`}
      style={{ width: size, height: size, ["--a" as string]: a } as React.CSSProperties}
    />
  );
}

/* ── mock data (these are placeholder people, faithful to the design) ── */
const TASTE_TWINS = [
  { name: "Wren M.", handle: "@wrenful", pct: 94, a: "50deg", why: (<><b>14</b> shared artists incl. <b>Marrow</b></>) },
  { name: "Iris D.", handle: "@irisd_", pct: 89, a: "160deg", why: (<><b>11</b> shared · same <b>lo-fi</b> hours</>) },
  { name: "Jonah B.", handle: "@jonahbb", pct: 86, a: "240deg", why: (<><b>9</b> shared · loves <b>Kite Season</b></>) },
  { name: "Luca R.", handle: "@lucalist", pct: 82, a: "320deg", why: (<><b>8</b> shared · same <b>ambient</b> niche</>) },
];

const FOF = [
  { name: "Pearl O.", pct: 78, a: "80deg", why: (<>followed by <b>Ava</b>, <b>Devin</b> +2</>) },
  { name: "Theo P.", pct: 72, a: "140deg", why: (<>followed by <b>Mona</b>, <b>Priya</b></>) },
  { name: "Sasha I.", pct: 69, a: "220deg", why: (<>followed by <b>Sam</b>, <b>Noor</b> +3</>) },
  { name: "Marin C.", pct: 65, a: "20deg", why: (<>followed by <b>Ava</b>, <b>Devin</b></>) },
];

const PULSE = [
  { name: "Wren M.", track: "Slow Tide — Marrow", a: "50deg", time: "0:42" },
  { name: "Iris D.", track: "Cinder — The Owls", a: "160deg", time: "1:18" },
  { name: "Jonah B.", track: "Amber Hours — Kite Season", a: "240deg", time: "2:05" },
  { name: "Luca R.", track: "Driftwood — Halcyon Bay", a: "320deg", time: "0:31" },
  { name: "Marin C.", track: "Glasshouse — Marrow", a: "90deg", time: "3:12" },
];

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

const SUGGESTIONS = ["marrow", "indie sad-girl", "lo-fi at 2am", "kite season fans", "@ava"];

type Connection = "fof" | "stranger" | "followed";
type Activity = "now" | "week" | "older";

interface Person {
  name: string;
  handle: string;
  mins: string;
  pct: number;
  a: string;
  connection: Connection;
  genres: string[];
  activity: Activity;
  recency: number; // minutes since last active — lower is more recent
  why: React.ReactNode;
  bio?: string; // pin handle line; falls back to a generated one
}

/* the searchable people pool — Wren leads so she can pin as the top match */
const PEOPLE: Person[] = [
  {
    name: "Wren M.", handle: "@wrenful", mins: "6.2k", pct: 94, a: "50deg",
    connection: "fof", genres: ["indie", "lo-fi", "dream-pop"], activity: "now", recency: 0,
    bio: "@wrenful · she/her · 6.2k min",
    why: (<><b>14</b> shared artists incl. <mark>Marrow</mark>, Kite Season · same lo-fi hours</>),
  },
  {
    name: "Iris D.", handle: "@irisd_", mins: "4.8k", pct: 89, a: "160deg",
    connection: "stranger", genres: ["lo-fi", "ambient", "shoegaze"], activity: "now", recency: 3,
    why: (<>11 shared · loves <mark>Marrow</mark></>),
  },
  {
    name: "Jonah B.", handle: "@jonahbb", mins: "3.4k", pct: 86, a: "240deg",
    connection: "stranger", genres: ["indie", "jazz", "folk"], activity: "week", recency: 240,
    why: (<>9 shared · incl. <mark>Marrow</mark> + Kite Season</>),
  },
  {
    name: "Luca R.", handle: "@lucalist", mins: "5.1k", pct: 82, a: "320deg",
    connection: "followed", genres: ["ambient", "neo-soul"], activity: "now", recency: 12,
    why: (<>8 shared · same ambient niche · top: <mark>Marrow</mark></>),
  },
  {
    name: "Pearl O.", handle: "@pearloh", mins: "7.0k", pct: 78, a: "80deg",
    connection: "fof", genres: ["indie", "jazz", "bedroom-pop"], activity: "week", recency: 90,
    why: (<>friends-of-friends · 6 shared incl. <mark>Marrow</mark></>),
  },
  {
    name: "Sasha I.", handle: "@sashai", mins: "2.9k", pct: 71, a: "220deg",
    connection: "stranger", genres: ["jazz", "ambient", "slowcore"], activity: "older", recency: 4320,
    why: (<>5 shared · same late-night hours</>),
  },
  {
    name: "Marin C.", handle: "@marincee", mins: "4.2k", pct: 68, a: "20deg",
    connection: "fof", genres: ["lo-fi", "dream-pop"], activity: "week", recency: 600,
    why: (<>5 shared · followed by 2 friends</>),
  },
];

/* genre options — base set is always shown, extras reveal on "+ N more" */
const BASE_GENRES = ["Indie", "Lo-fi", "Jazz", "Ambient"];
const EXTRA_GENRES = ["Folk", "Neo-soul", "Shoegaze", "Dream-pop", "Hyperpop", "Bedroom-pop", "Slowcore"];

/* sidebar filter groups */
const FILTER_GROUPS = [
  { title: "Connection", opts: ["Friends of friends", "Strangers", "Already followed"], on: ["Friends of friends"] },
  { title: "Genres", opts: BASE_GENRES, on: ["Indie"] },
  { title: "Activity", opts: ["Listening now", "Active this week", "Any time"], on: ["Listening now"] },
];

/* map a sidebar option label → the data values it admits (broadening unions) */
const CONNECTION_OPT: Record<string, Connection[]> = {
  "Friends of friends": ["fof"],
  Strangers: ["stranger"],
  "Already followed": ["followed"],
};
const ACTIVITY_OPT: Record<string, Activity[]> = {
  "Listening now": ["now"],
  "Active this week": ["now", "week"],
  "Any time": ["now", "week", "older"],
};

const DEFAULT_OPTS = () => {
  const init = new Set<string>();
  FILTER_GROUPS.forEach((g) => g.on.forEach((o) => init.add(`${g.title}:${o}`)));
  return init;
};

const DEFAULT_RANGE = { min: 60, max: 95 };

const SORTS = ["MATCH", "RECENT", "A–Z"] as const;

export default function DiscoverPage() {
  const { toast } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const openProfile = (handle: string) => {
    const userId = handle.replace("@", "");
    router.push(`/discover/${userId}`);
  };
  const trackRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [sortIdx, setSortIdx] = useState(0);

  /* active sidebar filter options, keyed by "group:opt" */
  const [activeOpts, setActiveOpts] = useState<Set<string>>(DEFAULT_OPTS);
  const toggleOpt = (key: string) =>
    setActiveOpts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /* match-score band (percent) driven by the dual-range slider */
  const [matchRange, setMatchRange] = useState(DEFAULT_RANGE);

  /* whether the extra genre options are revealed */
  const [genresOpen, setGenresOpen] = useState(false);

  const resetFilters = () => {
    setActiveOpts(DEFAULT_OPTS());
    setMatchRange(DEFAULT_RANGE);
    toast("Filters reset");
  };

  const hasQuery = query.trim().length > 0;

  /* ── apply the Refine controls to the people pool ── */
  const visible = useMemo(() => {
    /* collect the values admitted by each connection/activity group */
    const admitted = <T extends string>(group: string, map: Record<string, T[]>): Set<T> | null => {
      const sel = Object.keys(map).filter((o) => activeOpts.has(`${group}:${o}`));
      if (sel.length === 0) return null; // nothing selected → group is permissive
      const out = new Set<T>();
      sel.forEach((o) => map[o].forEach((v) => out.add(v)));
      return out;
    };
    const conn = admitted("Connection", CONNECTION_OPT);
    const act = admitted("Activity", ACTIVITY_OPT);

    /* selected genres (lowercased); null/empty → permissive */
    const genreSel = [...BASE_GENRES, ...EXTRA_GENRES]
      .filter((o) => activeOpts.has(`Genres:${o}`))
      .map((o) => o.toLowerCase());

    const list = PEOPLE.filter(
      (p) =>
        p.pct >= matchRange.min &&
        p.pct <= matchRange.max &&
        (!conn || conn.has(p.connection)) &&
        (!act || act.has(p.activity)) &&
        (genreSel.length === 0 || p.genres.some((g) => genreSel.includes(g))),
    );

    const sorted = [...list];
    if (sortIdx === 0) sorted.sort((a, b) => b.pct - a.pct); // MATCH
    else if (sortIdx === 1) sorted.sort((a, b) => a.recency - b.recency); // RECENT
    else sorted.sort((a, b) => a.name.localeCompare(b.name)); // A–Z
    return sorted;
  }, [activeOpts, matchRange, sortIdx]);

  const resCount = visible.length;
  const pin = visible[0] ?? null;
  const rows = visible.slice(1);

  /* match-score slider: dragging anywhere on the track grabs the nearest thumb.
     The thumbs are a tiny target and the page hides the cursor, so picking the
     nearest handle from a track-level press is what makes this usable. */
  const GAP = 5; // keep a minimum spread between the thumbs
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
    // pick the closer thumb to where the user pressed
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

  /* select a suggestion / vibe → seed the search and scroll to the bar */
  const runQuery = (q: string) => {
    setQuery(q);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const top = (inputRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
    });
  };

  /* ⌘K to focus, Esc to clear */
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
            placeholder={"Search by name, handle, or “people who love Marrow”…"}
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

        {/* when empty: try-these suggestions */}
        {!hasQuery && (
          <div className="db-sug-row">
            <span className="db-sl">Try</span>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="db-chip ghost" onClick={() => runQuery(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* when query: active filters */}
        {hasQuery && (
          <div className="db-filter-row">
            <span className="db-sl">Filters</span>
            <button className="db-chip accent removable" onClick={() => toast("Removed indie filter")}>
              indie
            </button>
            <button className="db-chip accent removable" onClick={() => toast("Removed match filter")}>
              match ≥ 60%
            </button>
            <button className="db-chip removable" onClick={() => toast("Removed friends-of-friends")}>
              friends-of-friends
            </button>
            <button className="db-chip ghost" onClick={() => toast("Add a filter")}>
              + filter
            </button>
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
              <button className="db-see" onClick={() => toast("See all 24 taste twins")}>
                see all 24 ▸
              </button>
            </div>
            <div className="db-tt-grid">
              {TASTE_TWINS.map((p) => (
                <div
                  key={p.handle}
                  className="db-card db-pcard"
                  role="button"
                  tabIndex={0}
                  onClick={() => openProfile(p.handle)}
                >
                  <span className="db-pc-corner">
                    <Dial pct={p.pct} size={38} />
                  </span>
                  <Fava size={64} a={p.a} />
                  <div>
                    <div className="db-pc-name">{p.name}</div>
                    <div className="db-pc-handle">{p.handle}</div>
                  </div>
                  <div className="db-pc-why">{p.why}</div>
                  <div className="db-pc-acts">
                    <button
                      className="db-btn primary sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast(`Followed ${p.name}`);
                      }}
                    >
                      Follow
                    </button>
                    <button
                      className="db-btn sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProfile(p.handle);
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FRIENDS-OF-FRIENDS + LIVE PULSE */}
          <section className="db-two-up">
            <div className="db-card">
              <div className="db-card-head">
                <div className="db-h-title">
                  Through your friends <em>— mutuals you don&apos;t follow yet</em>
                </div>
                <button className="db-see" onClick={() => toast("See all")}>
                  see all ▸
                </button>
              </div>
              <div>
                {FOF.map((f) => (
                  <div key={f.name} className="db-fof-row" role="button" tabIndex={0} onClick={() => openProfile(f.name.replace(" ", "").toLowerCase())}>
                    <Fava size={42} a={f.a} />
                    <div>
                      <div className="db-fof-name">{f.name}</div>
                      <div className="db-fof-why">{f.why}</div>
                    </div>
                    <Dial pct={f.pct} size={40} />
                    <button
                      className="db-btn primary sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast(`Followed ${f.name}`);
                      }}
                    >
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="db-card">
              <div className="db-card-head">
                <div className="db-h-title">Pulse</div>
                <span className="db-live-tag">
                  <span className="db-pulse" />5 live
                </span>
              </div>
              <div className="db-prows">
                {PULSE.map((p, i) => (
                  <div className="db-prow" key={`${p.name}-${i}`}>
                    <Fava size={32} a={p.a} />
                    <div className="db-prow-meta">
                      <div className="db-prow-n">{p.name}</div>
                      <div className="db-prow-t">{p.track}</div>
                    </div>
                    <span className="db-prow-time">{p.time}</span>
                  </div>
                ))}
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
              <button className="db-chip ghost" onClick={() => toast("More vibes")}>
                + 24 more
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
                <b>{resCount}</b> people match{" "}
                <span>
                  “
                  <i style={{ fontFamily: "var(--font-serif), serif", color: "var(--db-ink)" }}>{query}</i>
                  ” + your filters
                </span>
              </div>
              <div className="db-seg">
                {SORTS.map((s, i) => (
                  <button key={s} className={sortIdx === i ? "active" : ""} onClick={() => setSortIdx(i)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {pin ? (
              <>
                {/* pinned top match */}
                <div className="db-pin" role="button" tabIndex={0} onClick={() => openProfile(pin.handle)}>
                  <span className="db-pin-tag">top match</span>
                  <Fava size={84} a={pin.a} />
                  <div className="db-pin-info">
                    <div className="db-pin-name">{pin.name}</div>
                    <div className="db-pin-handle">
                      {pin.bio ?? `${pin.handle} · ${pin.mins} min`}
                    </div>
                    <div className="db-pin-why">{pin.why}</div>
                  </div>
                  <Dial pct={pin.pct} size={84} label="MATCH" />
                  <div className="db-pin-acts">
                    <button
                      className="db-btn primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast(`Followed ${pin.name}`);
                      }}
                    >
                      + Follow
                    </button>
                    <button
                      className="db-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProfile(pin.handle);
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
                      <div key={r.handle} className="db-res" role="button" tabIndex={0} onClick={() => openProfile(r.handle)}>
                        <Fava size={44} a={r.a} />
                        <div>
                          <div className="db-res-name">{r.name}</div>
                          <div className="db-res-handle">
                            {r.handle} · {r.mins} min
                          </div>
                          <div className="db-res-why">{r.why}</div>
                        </div>
                        <Dial pct={r.pct} size={48} />
                        <div className="db-res-acts">
                          <button
                            className="db-btn primary sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast(`Followed ${r.name}`);
                            }}
                          >
                            Follow
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="db-load-more">
                  <button className="db-btn" onClick={() => toast("Loading 12 more…")}>
                    Load 12 more
                  </button>
                </div>
              </>
            ) : (
              /* nothing matches the current filters */
              <div className="db-card db-no-results">
                <div className="db-nr-title">No people match these filters</div>
                <div className="db-nr-sub">Try widening the match score or clearing a filter.</div>
                <button className="db-btn primary sm" onClick={resetFilters}>
                  Reset filters
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
