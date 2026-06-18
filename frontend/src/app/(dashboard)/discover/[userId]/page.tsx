"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePublicProfile, useSendFriendRequest } from "@/hooks/useSocial";

/* ── SVG icon set ── */
const ICONS: Record<string, React.ReactNode> = {
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.9 6.7 19.7l1.1-6.1L3.4 9.4l6-.8L12 3z" />
    </svg>
  ),
  infinity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5.5 12c0-2.2 1.7-4 3.8-4 1.5 0 2.6.9 3.7 2.4 1.1 1.5 2.2 2.4 3.7 2.4 2 0 3.8-1.8 3.8-4s-1.7-4-3.8-4c-1.5 0-2.6.9-3.7 2.4-1.1 1.5-2.2 2.4-3.7 2.4-2 0-3.8 1.8-3.8 4z" transform="translate(-.5 2)" />
    </svg>
  ),
  crate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M3.5 14l4.5-1M20.5 10l-4.5 1" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  ),
  curator: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 6h12M4 12h12M4 18h8" />
      <path d="M19 15v6M16 18h6" />
    </svg>
  ),
  repeat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 10V8a2 2 0 0 1 2-2h12l-3-2.5M20 14v2a2 2 0 0 1-2 2H6l3 2.5" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  headphones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 14a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-2v-7h4M3 14v5a2 2 0 0 0 2 2h2v-7H3" />
    </svg>
  ),
  friends: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c.6-3.2 3.4-5 6.5-5s5.9 1.8 6.5 5" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M16 14c2.6 0 4.7 1.4 5.5 4" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5M3 18l9 5 9-5" />
    </svg>
  ),
  festival: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 21l9-15 9 15z" />
      <path d="M3 21h18M8 21v-4M16 21v-4M12 14v7" />
    </svg>
  ),
};

interface Badge {
  name: string;
  tag: string;
  icon: keyof typeof ICONS;
  h: number;
  earned: boolean;
  desc: string;
  progress?: number;
}

const BADGES: Badge[] = [
  { name: "Early Bird",   tag: "2024",       icon: "star",       h: 140, earned: true,  desc: "Joined Resonance in the first 1,000 listeners." },
  { name: "Day 100",      tag: "streak",     icon: "infinity",   h: 180, earned: true,  desc: "Listened 100 days in a row." },
  { name: "Crate Dig",    tag: "obscure",    icon: "crate",      h: 40,  earned: true,  desc: "Played 50+ tracks under 10k monthly listeners." },
  { name: "Night Owl",    tag: "2am club",   icon: "moon",       h: 260, earned: true,  desc: "Most plays between midnight and 4am." },
  { name: "Curator",      tag: "10+ lists",  icon: "curator",    h: 90,  earned: true,  desc: "Built 10 or more public playlists." },
  { name: "Re-listen",    tag: "100×",       icon: "repeat",     h: 210, earned: true,  desc: "Replayed a single track 100 times." },
  { name: "Polyglot",     tag: "6 langs",    icon: "globe",      h: 330, earned: true,  desc: "Listened in 6+ different languages." },
  { name: "365 Days",     tag: "yearly",     icon: "headphones", h: 0,   earned: false, desc: "Listen 365 days in a row.",            progress: 39 },
  { name: "1,000 Tracks", tag: "collector",  icon: "headphones", h: 0,   earned: false, desc: "Save 1,000 tracks to your library.",   progress: 62 },
  { name: "Squad",        tag: "social",     icon: "friends",    h: 0,   earned: false, desc: "Add 5 friends on Resonance.",          progress: 20 },
  { name: "Polyrhythm",   tag: "genres",     icon: "layers",     h: 0,   earned: false, desc: "Play 10 distinct genres in a month.",  progress: 70 },
  { name: "Festival",     tag: "live",       icon: "festival",   h: 0,   earned: false, desc: "Attend a live event and check in.",    progress: 0 },
];

const DNA_ROWS = [
  { key: "Energy",    desc: "how driving your tracks feel",   val: 72, delta: "+8",  up: true,  fill: "green", width: 72 },
  { key: "Acoustic",  desc: "unplugged vs produced",          val: 58, delta: "+3",  up: true,  fill: "",      width: 58 },
  { key: "Mellow",    desc: "your gravity setting",           val: 81, delta: "+12", up: true,  fill: "green", width: 81 },
  { key: "Dance",     desc: "rhythmic regularity",            val: 34, delta: "−6",  up: false, fill: "soft",  width: 34 },
  { key: "Discovery", desc: "% new artists per week",         val: 46, delta: "+9",  up: true,  fill: "",      width: 46 },
  { key: "Obscurity", desc: "below 50k monthly listeners",    val: 63, delta: "+4",  up: true,  fill: "",      width: 63 },
];

/* ── small badge card (6-up grid) ── */
function BadgeCard({ b }: { b: Badge }) {
  const icon = b.earned ? ICONS[b.icon] : ICONS.lock;
  return (
    <div className={`db-badge${b.earned ? "" : " locked"}`}>
      <div className="db-badge-mk" style={b.earned ? ({ "--h": b.h } as React.CSSProperties) : {}}>
        {icon}
      </div>
      <div className="db-badge-name">{b.name}</div>
      <div className="db-badge-tag">{b.tag}</div>
    </div>
  );
}

/* ── big badge card (modal) ── */
function BadgeBig({ b }: { b: Badge }) {
  return (
    <div className={`db-badge db-badge-big${b.earned ? "" : " locked"}`}>
      <div className="db-badge-mk" style={b.earned ? ({ "--h": b.h } as React.CSSProperties) : {}}>
        {ICONS[b.icon]}
      </div>
      <div className="db-badge-text">
        <div className="db-badge-name">{b.name}</div>
        <div className="db-badge-desc">{b.desc}</div>
        {b.earned ? (
          <div className="db-badge-meta">
            <span className="db-badge-dot earned" />
            Earned
          </div>
        ) : (
          <div className="db-badge-meta">
            <div className="db-badge-prog">
              <div className="db-badge-prog-fill" style={{ width: `${b.progress ?? 0}%` }} />
            </div>
            <span className="db-badge-prog-n">{b.progress ?? 0}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── badges modal ── */
function BadgesModal({ onClose }: { onClose: () => void }) {
  const earned = BADGES.filter((b) => b.earned);
  const locked = BADGES.filter((b) => !b.earned);
  const pct = Math.round((earned.length / BADGES.length) * 100);

  return (
    <div className="db-modal-root open" role="dialog" aria-modal="true" aria-label="All badges">
      <div className="db-modal-scrim" onClick={onClose} />
      <div className="db-modal-shell">
        <div className="db-modal-head">
          <div>
            <div className="db-lbl">Achievements</div>
            <div className="db-h-title" style={{ marginTop: 6, fontSize: 30 }}>
              All <em>badges</em>
            </div>
          </div>
          <button className="db-modal-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <div className="db-modal-progress">
          <div className="db-mp-stat">
            <span className="db-mp-n">{earned.length}</span>
            <span className="db-mp-d">/ {BADGES.length}</span>
          </div>
          <div className="db-mp-bar">
            <div className="db-mp-track">
              <div className="db-mp-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="db-mp-cap">
              <span>{pct}% complete</span>
              <span>{locked.length} to go</span>
            </div>
          </div>
        </div>

        <div className="db-modal-section-label">
          <span>Earned · {earned.length}</span>
          <span style={{ color: "var(--db-spotify)" }}>●</span>
        </div>
        <div className="db-big-grid">
          {earned.map((b) => <BadgeBig key={b.name} b={b} />)}
        </div>

        <div className="db-modal-section-label" style={{ marginTop: 30 }}>
          <span>Locked · {locked.length}</span>
        </div>
        <div className="db-big-grid">
          {locked.map((b) => <BadgeBig key={b.name} b={b} />)}
        </div>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const { data: profile, isLoading, isError } = usePublicProfile(userId);
  const { mutate: sendRequest } = useSendFriendRequest();

  const [timePeriod, setTimePeriod] = useState<0 | 1 | 2>(1);
  const [followed, setFollowed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const isFriend = profile?.relation === "friend";
  const isSelf = profile?.relation === "self";
  const isLiveNow = profile?.shared?.nowplaying?.visible === true;

  const periods = ["4 WEEKS", "6 MONTHS", "ALL TIME"];

  if (isError) {
    return (
      <main className="db-page">
        <div className="db-head-row">
          <div>
            <div className="db-eyebrow">
              <button className="db-profile-back" onClick={() => router.back()}>← Discover</button>
            </div>
          </div>
        </div>
        <div className="db-card" style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>User not found</div>
          <div style={{ color: "var(--db-ink-faint)", fontSize: 13, marginBottom: 20 }}>
            This profile doesn't exist or isn't available.
          </div>
          <button className="db-btn primary sm" onClick={() => router.back()}>Go back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="db-page">
      {/* head row */}
      <div className="db-head-row">
        <div>
          <div className="db-eyebrow">
            <button
              className="db-profile-back"
              onClick={() => router.back()}
              aria-label="Back to Discover"
            >
              ← Discover
            </button>
          </div>
          <h1 className="db-greeting">
            Their listener <em>identity</em>.
          </h1>
        </div>
        <div className="db-seg">
          {periods.map((p, i) => (
            <button
              key={p}
              className={timePeriod === i ? "active" : ""}
              onClick={() => setTimePeriod(i as 0 | 1 | 2)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── profile grid ── */}
      <section className="db-profile-grid">

        {/* ── PASSPORT CARD ── */}
        <aside className="db-card db-passport">
          <div className="db-pp-stamp">
            <b>VERIFIED</b>
            <span>LISTENER</span>
          </div>

          {isLoading ? (
            <div className="db-pp-avatar" style={{ background: "var(--db-hair)", opacity: 0.4 }} />
          ) : (profile?.avatar_url || profile?.profile_image_url) ? (
            <div
              className="db-pp-avatar"
              style={{ backgroundImage: `url(${profile.avatar_url ?? profile.profile_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
          ) : (
            <div className="db-pp-avatar" />
          )}

          {isLoading ? (
            <>
              <div style={{ height: 28, width: 140, background: "var(--db-hair)", borderRadius: 4, margin: "8px auto 4px" }} />
              <div style={{ height: 14, width: 100, background: "var(--db-hair)", borderRadius: 4, margin: "0 auto 10px", opacity: 0.5 }} />
              <div style={{ height: 40, width: "80%", background: "var(--db-hair)", borderRadius: 4, margin: "0 auto", opacity: 0.3 }} />
            </>
          ) : (
            <>
              <h2 className="db-pp-name">{profile?.display_name ?? "Unknown"}</h2>
              {profile?.handle && <div className="db-pp-handle">@{profile.handle}</div>}
              {profile?.bio && <p className="db-pp-bio">{profile.bio}</p>}
            </>
          )}

          <div className="db-pp-meta">
            <div>
              <div className="db-pp-v">—</div>
              <div className="db-pp-k">Followers</div>
            </div>
            <div>
              <div className="db-pp-v">—</div>
              <div className="db-pp-k">Following</div>
            </div>
            <div>
              <div className="db-pp-v">—</div>
              <div className="db-pp-k">Playlists</div>
            </div>
          </div>

          {!isSelf && (
            <div className="db-pp-actions">
              <button
                className={`db-btn${(followed || isFriend) ? "" : " primary"} db-pp-btn`}
                onClick={() => {
                  if (!followed && !isFriend) {
                    sendRequest(userId, { onSuccess: () => setFollowed(true) });
                  }
                }}
                disabled={followed || isFriend}
              >
                {(followed || isFriend) ? "Connected" : "+ Connect"}
              </button>
              <button className="db-btn db-pp-btn" onClick={() => router.push(`/messages`)}>Message</button>
            </div>
          )}

          <div className="db-pp-foot">
            <span>RES · Resonance</span>
            {isLiveNow && (
              <span className="db-pp-live">
                <span className="db-pulse" />
                Live now
              </span>
            )}
          </div>
        </aside>

        {/* ── RIGHT COL ── */}
        <div className="db-profile-right">

          {/* DNA */}
          <div className="db-card">
            <div className="db-card-head">
              <div className="db-h-title">
                Listener <em>DNA</em>
              </div>
              <span className="db-lbl">{periods[timePeriod].toLowerCase()}</span>
            </div>
            <div className="db-dna-grid">
              {DNA_ROWS.map((row) => (
                <div className="db-dna-row" key={row.key}>
                  <div className="db-dna-top">
                    <div>
                      <div className="db-dna-k">{row.key}</div>
                      <div className="db-dna-desc">{row.desc}</div>
                    </div>
                    <div className="db-dna-v">
                      {row.val}
                      <span className={`db-dna-delta${row.up ? " up" : " down"}`}>{row.delta}</span>
                    </div>
                  </div>
                  <div className="db-dna-track">
                    <div
                      className={`db-dna-fill${row.fill === "green" ? " green" : row.fill === "soft" ? " soft" : ""}`}
                      style={{ width: `${row.width}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="db-profile-stat-row">
            <div className="db-card">
              <div className="db-card-head">
                <span className="db-lbl">Hours listened</span>
              </div>
              <div className="db-stat">702</div>
              <div className="db-stat-cap">
                <span className="db-trend-up" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>▲ 8%</span>
                vs prior 6mo
              </div>
            </div>
            <div className="db-card">
              <div className="db-card-head">
                <span className="db-lbl">Top genre</span>
              </div>
              <div className="db-stat" style={{ fontSize: 32, fontStyle: "italic" }}>
                <em>indie</em>&nbsp;folk
              </div>
              <div className="db-stat-cap">31% of plays · 4 sub-genres</div>
            </div>
            <div className="db-card">
              <div className="db-card-head">
                <span className="db-lbl">Discoveries</span>
              </div>
              <div className="db-stat">218</div>
              <div className="db-stat-cap">new artists since Jan</div>
            </div>
          </div>

          {/* Anthem + Vibe */}
          <div className="db-anthem-card">
            <div className="db-anthem">
              <div className="db-anthem-cv" />
              <div className="db-anthem-meta">
                <div className="db-lbl" style={{ marginBottom: 8 }}>Anthem of the season</div>
                <div className="db-anthem-tt">Amber Hours</div>
                <div className="db-anthem-at">Kite Season · 2023</div>
                <div className="db-anthem-why">88 plays · most replayed</div>
              </div>
            </div>
            <div className="db-card db-vibe">
              <div className="db-lbl">Vibe summary</div>
              <div className="db-vibe-lead">
                slow &amp; <em>amber</em> — mellow folk with a 90s tinge.
              </div>
              <div className="db-chips" style={{ marginTop: 8 }}>
                <span className="db-chip accent">slow build</span>
                <span className="db-chip accent">female vocal</span>
                <span className="db-chip">jazz piano</span>
                <span className="db-chip">winter mood</span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="db-card">
            <div className="db-card-head">
              <div className="db-h-title">
                Badges <em>· 7 of 12</em>
              </div>
              <button className="db-btn db-btn sm" onClick={() => setModalOpen(true)}>
                See all
              </button>
            </div>
            <div className="db-badges-grid">
              {BADGES.map((b) => <BadgeCard key={b.name} b={b} />)}
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

      {/* badges modal */}
      {modalOpen && <BadgesModal onClose={() => setModalOpen(false)} />}
    </main>
  );
}
