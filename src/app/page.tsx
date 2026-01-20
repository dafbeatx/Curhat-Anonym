"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/* =========================
   CONSTANTS
========================= */
const REACTIONS: Record<string, string> = {
  read: "🤍",
  hug: "🫂",
  hope: "🌱",
  pray: "🙏",
  listen: "🕯️",
};

const MOOD_META: Record<string, { emoji: string; color: string; label: string }> = {
  marah: { emoji: "😡", color: "#ef4444", label: "Marah" },
  sedih: { emoji: "😢", color: "#3b82f6", label: "Sedih" },
  bahagia: { emoji: "😄", color: "#22c55e", label: "Bahagia" },
  lelah: { emoji: "😫", color: "#6366f1", label: "Lelah" },
  kecewa: { emoji: "😕", color: "#f59e0b", label: "Kecewa" },
  netral: { emoji: "🙂", color: "#64748b", label: "Netral" },
};

const ENCOURAGEMENTS = [
  "Kamu tidak sendirian. 🫂",
  "Terima kasih sudah jujur dengan perasaanmu. ✨",
  "Napas yang dalam, semua akan baik-baik saja. 🌱",
  "Perasaanmu valid, dan kamu berhak didengar. 🕯️",
  "Hari esok adalah kesempatan baru. ☀️",
  "Kamu sudah berjuang sejauh ini, bangga padamu! 🤍",
];

const FILTERS = ["Semua", "Bahagia", "Sedih", "Marah", "Lelah", "Kecewa", "Netral"];

interface CurhatItem {
  id: string;
  text: string;
  mood: string;
  emoji: string;
  name: string;
  created_at: string;
  reactions: { type: string }[];
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function Home() {
  const [text, setText] = useState("");
  const [curhats, setCurhats] = useState<CurhatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState("light");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filter, setFilter] = useState("Semua");
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }

    loadCurhats();

    const channel = sb
      .channel("realtime-curhat")
      .on("postgres_changes" as any, { event: "*", table: "curhat", schema: "public" }, () => loadCurhats())
      .on("postgres_changes" as any, { event: "*", table: "reactions", schema: "public" }, () => loadCurhats())
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const loadCurhats = async () => {
    const sb = getSupabase();
    if (!sb) return;

    try {
      const { data, error } = await (sb.from("curhat") as any)
        .select("*, reactions(type)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCurhats(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Load failed:", err);
      setError("Gagal memuat curhatan. Pastikan koneksi internet stabil.");
    } finally {
      setLoading(false);
    }
  };

  const addToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const playSendSound = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  };

  const detectMood = (text: string) => {
    const t = text.toLowerCase();
    if (/anjing|bangsat|emosi|marah|benci/.test(t)) return "marah";
    if (/sedih|capek|nangis|lelah|hancur/.test(t)) return "sedih";
    if (/senang|bahagia|lega|syukur|mantap/.test(t)) return "bahagia";
    if (/kecewa|bohong|jahat|php/.test(t)) return "kecewa";
    if (/lelah|letih|lesu|malas/.test(t)) return "lelah";
    return "netral";
  };

  const sendCurhat = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Anti-spam check (60 seconds)
    const lastPost = localStorage.getItem("last_post_time");
    const now = Date.now();
    if (lastPost && now - parseInt(lastPost) < 60000) {
      const wait = Math.ceil((60000 - (now - parseInt(lastPost))) / 1000);
      addToast(`Tunggu ${wait} detik lagi ya untuk curhat kembali. 🧊`, "info");
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      addToast("Koneksi ke database gagal. Periksa konfigurasi API.", "error");
      return;
    }

    setSending(true);
    const mood = detectMood(trimmed);
    const meta = MOOD_META[mood] || MOOD_META.netral;

    const { error } = await (sb.from("curhat") as any).insert({
      text: trimmed,
      mood,
      emoji: meta.emoji,
      name: "Anonim",
    });

    setSending(false);

    if (error) {
      addToast("Gagal mengirim curhat. Coba lagi nanti.", "error");
      return;
    }

    playSendSound();
    setText("");
    localStorage.setItem("last_post_time", now.toString());

    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    addToast(msg, "success");
    loadCurhats();
  };

  const sendReaction = async (id: string, type: string) => {
    if (localStorage.getItem(`reacted_${id}_${type}`)) {
      addToast("Kamu sudah memberikan reaksi ini. 🤍", "info");
      return;
    }

    const sb = getSupabase();
    if (!sb) return;

    const { error } = await (sb.from("reactions") as any).insert({ curhat_id: id, type });
    if (!error) {
      localStorage.setItem(`reacted_${id}_${type}`, "1");
      // Local state update for instant feedback
      setCurhats(prev => prev.map(c => {
        if (c.id === id) {
          return { ...c, reactions: [...c.reactions, { type }] };
        }
        return c;
      }));
    }
  };

  const filteredCurhats = useMemo(() => {
    if (filter === "Semua") return curhats;
    return curhats.filter(c => (c.mood || "netral").toLowerCase() === filter.toLowerCase());
  }, [curhats, filter]);

  const shareLink = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#card-${id}`;
    if (navigator.share) {
      await navigator.share({ title: "Curhat Anonim", url });
    } else {
      await navigator.clipboard.writeText(url);
      addToast("Link berhasil disalin ke clipboard! 🔗", "success");
    }
  };

  const shareAsImage = async (id: string) => {
    const card = document.getElementById(`card-${id}`);
    if (!card) return;

    const textEl = card.querySelector(".text") as HTMLElement;
    const textStr = textEl.innerText;
    const currentTheme = document.documentElement.getAttribute("data-theme");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 600;
    const padding = 40;
    const lineHeight = 28;
    const fontSize = 18;

    ctx.font = `${fontSize}px Inter, sans-serif`;

    const words = textStr.split(" ");
    let lines = [];
    let line = "";

    words.forEach((w) => {
      const test = line + w + " ";
      if (ctx.measureText(test).width > width - padding * 2) {
        lines.push(line);
        line = w + " ";
      } else line = test;
    });
    lines.push(line);

    const height = padding * 2 + lines.length * lineHeight + 60;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = currentTheme === "dark" ? "#0f172a" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Text
    ctx.fillStyle = currentTheme === "dark" ? "#f8fafc" : "#1e293b";
    ctx.font = `${fontSize}px Inter, sans-serif`;
    lines.forEach((l, i) => {
      ctx.fillText(l.trim(), padding, padding + i * lineHeight + fontSize);
    });

    // Brand
    ctx.font = "14px Inter, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("🎭 Curhat Anonim", padding, height - 20);

    const img = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = img;
    a.download = `curhat-${id.substring(0, 5)}.png`;
    a.click();
    addToast("Gambar berhasil disimpan! 🖼️", "success");
  };

  return (
    <div className="page">
      {/* TOAST SYSTEM */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>

      <main className="container">
        <header className="header">
          <div className="header-title">
            <h1>Curhat Anonim</h1>
            <p className="hint">
              Tempat aman untuk meluapkan isi hati.<br />
              Tanpa akun. Tanpa nama. Tanpa jejak.
            </p>
          </div>
        </header>

        <section className="input-area">
          <div className="emoji-bar">
            {Object.values(MOOD_META).map((m) => (
              <button
                key={m.emoji}
                type="button"
                onClick={() => {
                  setText((prev) => prev + m.emoji);
                  addToast(`Emosi ${m.label} terpilih!`, "info");
                }}
                title={m.label}
              >
                {m.emoji}
              </button>
            ))}
          </div>

          <textarea
            id="curhat-input"
            placeholder="Tulis curhatanmu di sini..."
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendCurhat();
              }
            }}
          ></textarea>

          <button
            id="kirim"
            className="btn-primary"
            onClick={sendCurhat}
            disabled={sending || !text.trim()}
          >
            {sending ? "Mengirim..." : "Kirim Curhat"}
          </button>
        </section>

        {/* FILTER BAR SECTION */}
        <div className="filter-container">
          <span className="filter-label">Filter Emosi</span>
          <div className="filter-bar">
            {FILTERS.map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <section id="list-curhat" className="list-curhat">
          {loading ? (
            <div className="empty-state">Memuat curhatan...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : filteredCurhats.length === 0 ? (
            <div className="empty-state">
              {filter === "Semua" ? "Belum ada curhatan. Jadi yang pertama bercerita!" : `Belum ada curhatan berkeluh kesah ${filter.toLowerCase()}.`}
            </div>
          ) : (
            filteredCurhats.map((row) => {
              const meta = MOOD_META[row.mood] || MOOD_META.netral;
              const counts: Record<string, number> = {};
              (row.reactions || []).forEach((r) => {
                if (r && r.type) {
                  counts[r.type] = (counts[r.type] || 0) + 1;
                }
              });

              return (
                <div className="item" id={`card-${row.id}`} key={row.id}>
                  <div className="item-header">
                    <div className="item-user">
                      <div className="avatar">{row.emoji || "😶"}</div>
                      <div className="name-box">
                        <div className="name">{row.name || "Anonim"}</div>
                      </div>
                    </div>
                    <span className="badge" style={{ background: meta.color }}>
                      {row.mood || "netral"}
                    </span>
                  </div>

                  <div className="text" id={`curhat-${row.id}`}>
                    {row.text}
                  </div>

                  <div className="reaction-container">
                    <div className="reaction-bar">
                      {Object.entries(REACTIONS).map(([t, e]) => {
                        const count = counts[t] || 0;
                        const hasReacted = typeof window !== 'undefined' && localStorage.getItem(`reacted_${row.id}_${t}`);
                        return (
                          <button
                            key={t}
                            className={`reaction-btn ${hasReacted ? 'reacted' : ''}`}
                            onClick={() => sendReaction(row.id, t)}
                            title={t}
                          >
                            <span className="reaction-emoji">{e}</span>
                            <span className="reaction-count">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card-actions">
                    <button
                      className="icon-btn share"
                      onClick={() => shareLink(row.id)}
                      title="Salin Link"
                    ></button>
                    <button
                      className="icon-btn image"
                      onClick={() => shareAsImage(row.id)}
                      title="Simpan Gambar"
                    ></button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      <footer className="footer" style={{ textAlign: 'center', padding: '20px' }}>
        <p className="footer-text">Kalau tempat ini ngebantu kamu, dukung pengembangannya</p>
        <a
          href="https://saweria.co/dafbeatx"
          target="_blank"
          rel="noopener"
          className="footer-link"
          style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}
        >
          ☕ Dukung via Saweria 🤍
        </a>
      </footer>

      <button
        className="theme-fab"
        id="theme-toggle"
        aria-label="Ganti tema"
        title="Ganti tema"
        onClick={toggleTheme}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
