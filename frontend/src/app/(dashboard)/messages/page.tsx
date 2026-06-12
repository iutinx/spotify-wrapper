"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, useMessages, useRealtimeMessages, useSendMessage } from "@/hooks/useMessages";
import { apiClient } from "@/lib/api-client";
import type { Conversation, DirectMessage } from "@/types";

/* ── helpers ── */
function avatarStyle(user: { profile_image_url?: string | null }, angle: string) {
  return user.profile_image_url
    ? { backgroundImage: `url(${user.profile_image_url})` }
    : ({ "--a": angle } as React.CSSProperties);
}

function angleFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `${h}deg`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/* ── empty state ── */
function EmptyThread({ onStartNew }: { onStartNew: () => void }) {
  return (
    <div className="dm-empty-thread">
      <div className="dm-empty-icon">✉</div>
      <div className="dm-empty-title">Your messages</div>
      <div className="dm-empty-sub">Send a message to a friend to start a conversation.</div>
      <button className="db-btn primary" onClick={onStartNew}>
        New conversation
      </button>
    </div>
  );
}

/* ── new conversation search overlay ── */
function NewConvSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (userId: string, displayName: string) => void;
}) {
  const [q, setQ] = useState("");
  const { data: results, isFetching } = useQuery({
    queryKey: ["user-search-dm", q],
    queryFn: async () => {
      if (!q.trim()) return [];
      const res = await apiClient.get<{ items: { id: string; display_name: string; profile_image_url: string | null }[] }>(
        `/api/social/search?q=${encodeURIComponent(q)}&limit=10`,
      );
      return res.data.items ?? [];
    },
    enabled: q.trim().length > 0,
  });

  if (!open) return null;
  return (
    <div className="dm-overlay" onClick={onClose}>
      <div className="dm-sheet db-card" onClick={(e) => e.stopPropagation()}>
        <div className="dm-sheet-head">
          <span className="db-lbl">New conversation</span>
          <button className="dm-close" onClick={onClose}>✕</button>
        </div>
        <div className="dm-sheet-search">
          <input
            autoFocus
            placeholder="Search friends…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="dm-sheet-results">
          {isFetching && <div className="dm-sheet-loading">Searching…</div>}
          {!isFetching && q && (!results || results.length === 0) && (
            <div className="dm-sheet-loading">No users found.</div>
          )}
          {results?.map((u) => (
            <button
              key={u.id}
              className="dm-sheet-row"
              onClick={() => {
                onSelect(u.id, u.display_name ?? "User");
                onClose();
              }}
            >
              <div
                className={`db-favatar${u.profile_image_url ? "" : " gen"}`}
                style={{ width: 36, height: 36, ...avatarStyle(u, angleFor(u.id)) }}
              />
              <span className="dm-sheet-name">{u.display_name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── main page ── */
export default function MessagesPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const sendMessage = useSendMessage();

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(null);
  const [selectedOtherName, setSelectedOtherName] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<DirectMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useConversations();
  const { data: fetchedMessages } = useMessages(selectedConvId);

  /* merge fetched + locally-optimistic messages */
  const messages = fetchedMessages ?? localMessages;

  /* scroll to bottom whenever thread changes */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* clear local messages when conversation changes */
  useEffect(() => {
    setLocalMessages([]);
  }, [selectedConvId]);

  /* real-time incoming messages */
  useRealtimeMessages((payload) => {
    if (payload.conversation_id === selectedConvId) {
      setLocalMessages((prev) => [
        ...prev,
        {
          id: payload.message_id,
          conversation_id: payload.conversation_id,
          sender_id: payload.sender_id,
          content: payload.content,
          is_read: false,
          created_at: payload.created_at,
        },
      ]);
    }
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  });

  async function handleSend() {
    if (!draft.trim() || !selectedOtherUserId || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    try {
      const msg = await sendMessage(selectedOtherUserId, text);
      /* add to local list optimistically then invalidate to refetch */
      setLocalMessages((prev) => [...prev, msg]);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } finally {
      setSending(false);
    }
  }

  function selectConversation(conv: Conversation) {
    setSelectedConvId(conv.id);
    setSelectedOtherUserId(conv.other_user.id);
    setSelectedOtherName(conv.other_user.display_name ?? "User");
    setLocalMessages([]);
  }

  function handleNewConvSelect(userId: string, displayName: string) {
    /* check if we already have a conversation with this user */
    const existing = conversations?.find((c) => c.other_user.id === userId);
    if (existing) {
      selectConversation(existing);
    } else {
      setSelectedConvId(null);
      setSelectedOtherUserId(userId);
      setSelectedOtherName(displayName);
      setLocalMessages([]);
    }
  }

  const otherUserImage =
    conversations?.find((c) => c.other_user.id === selectedOtherUserId)?.other_user.profile_image_url ?? null;

  return (
    <main className="db-page dm-page" data-screen-label="Messages">
      {/* head */}
      <div className="db-head-row" style={{ marginBottom: 24 }}>
        <div>
          <div className="db-eyebrow">Direct messages</div>
          <h1 className="db-greeting">
            Your <em>conversations.</em>
          </h1>
        </div>
        <button className="db-btn primary" onClick={() => setNewConvOpen(true)}>
          + New
        </button>
      </div>

      <div className="dm-shell">
        {/* sidebar: conversation list */}
        <aside className="dm-sidebar db-card">
          <div className="dm-sidebar-head">
            <span className="db-lbl">Messages</span>
            {conversations && conversations.some((c) => c.unread_count > 0) && (
              <span className="dm-unread-dot" />
            )}
          </div>
          {!conversations || conversations.length === 0 ? (
            <div className="dm-sidebar-empty">No conversations yet.</div>
          ) : (
            <div className="dm-conv-list">
              {conversations.map((conv) => {
                const isActive = conv.id === selectedConvId;
                const a = angleFor(conv.other_user.id);
                return (
                  <button
                    key={conv.id}
                    className={`dm-conv-row${isActive ? " active" : ""}`}
                    onClick={() => selectConversation(conv)}
                  >
                    <div
                      className={`db-favatar dm-conv-av${conv.other_user.profile_image_url ? "" : " gen"}`}
                      style={avatarStyle(conv.other_user, a)}
                    />
                    <div className="dm-conv-meta">
                      <div className="dm-conv-name">
                        {conv.other_user.display_name ?? "User"}
                        {conv.unread_count > 0 && (
                          <span className="dm-badge">{conv.unread_count}</span>
                        )}
                      </div>
                      <div className="dm-conv-preview">
                        {conv.last_message
                          ? conv.last_message.content.slice(0, 42) + (conv.last_message.content.length > 42 ? "…" : "")
                          : "No messages yet"}
                      </div>
                    </div>
                    <span className="dm-conv-time">
                      {conv.last_message ? relativeTime(conv.last_message.created_at) : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* main: thread */}
        <section className="dm-thread db-card">
          {!selectedOtherUserId ? (
            <EmptyThread onStartNew={() => setNewConvOpen(true)} />
          ) : (
            <>
              {/* thread header */}
              <div className="dm-thread-head">
                <div
                  className={`db-favatar dm-thread-av${otherUserImage ? "" : " gen"}`}
                  style={{ width: 38, height: 38, ...avatarStyle({ profile_image_url: otherUserImage }, angleFor(selectedOtherUserId)) }}
                />
                <div>
                  <div className="dm-thread-name">{selectedOtherName}</div>
                  <div className="db-lbl" style={{ marginTop: 2 }}>Resonance member</div>
                </div>
              </div>

              {/* messages */}
              <div className="dm-messages">
                {messages.length === 0 && (
                  <div className="dm-thread-empty">
                    Say hi to {selectedOtherName} 👋
                  </div>
                )}
                {messages.map((msg) => {
                  const isMine = msg.sender_id === currentUser?.id;
                  return (
                    <div key={msg.id} className={`dm-msg${isMine ? " mine" : " theirs"}`}>
                      <div className="dm-bubble">{msg.content}</div>
                      <div className="dm-msg-time">{relativeTime(msg.created_at)}</div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* input bar */}
              <div className="dm-composer">
                <input
                  className="dm-input"
                  placeholder={`Message ${selectedOtherName}…`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                  maxLength={2000}
                />
                <button
                  className={`db-btn primary dm-send${!draft.trim() || sending ? " disabled" : ""}`}
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="db-footer">
        <span>© Resonance 2026</span>
        <span>{conversations?.length ?? 0} conversations · v0.4.2</span>
      </div>

      <NewConvSheet
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onSelect={handleNewConvSelect}
      />
    </main>
  );
}
