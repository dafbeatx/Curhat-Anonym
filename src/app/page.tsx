"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/* =========================
   MOOD & REACTION CONSTANTS
========================= */
const REACTIONS: Record<string, string> = {
  read: "🤍",
  hug: "🫂",
  hope: "🌱",
  pray: "🙏",
  listen: "🕯️",
};

function detectMood(text: string) {
  const t = text.toLowerCase();
  if (/anjing|bangsat|emosi|marah/.test(t)) return "marah";
  if (/sedih|capek|nangis|lelah/.test(t)) return "sedih";
  if (/senang|bahagia|lega|syukur/.test(t)) return "bahagia";
  return "netral";
}

function moodMeta(mood: string) {
  const meta: Record<string, { emoji: string; color: string; name: string }> = {
    marah: { emoji: "😡", color: "#ef4444", name: "si pemarah" },
    sedih: { emoji: "😢", color: "#3b82f6", name: "si capek hidup" },
    bahagia: { emoji: "😄", color: "#22c55e", name: "si paling bahagia" },
    netral: { emoji: "🙂", color: "#64748b", name: "si anonim" },
  };
  return meta[mood] || { emoji: "😶", color: "#94a3b8", name: "si anonim" };
}

interface CurhatItem {
  id: string;
  text: string;
  mood: string;
  emoji: string;
  name: string;
  created_at: string;
  reactions: { type: string }[];
}

export default function Home() {
  const [text, setText] = useState("");
  const [curhats, setCurhats] = useState<CurhatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState("light");
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initial theme
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    loadCurhats();

    // Realtime subscription
    const channel = supabase
      .channel("realtime-curhat")
      .on(
        "postgres_changes" as any,
        { event: "*", table: "curhat", schema: "public" },
        () => loadCurhats()
      )
      .on(
        "postgres_changes" as any,
        { event: "*", table: "reactions", schema: "public" },
        () => loadCurhats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCurhats = async () => {
    try {
      const { data, error } = await supabase
        .from("curhat")
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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 220;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  };

  const sendCurhat = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const mood = detectMood(trimmed);
    const meta = moodMeta(mood);

    const { error } = await supabase.from("curhat").insert({
      text: trimmed,
      mood,
      emoji: meta.emoji,
      name: meta.name,
    });

    if (error) {
      alert("Gagal mengirim curhat");
      return;
    }

    playSendSound();
    setText("");
    loadCurhats();
  };

  const sendReaction = async (id: string, type: string) => {
    if (localStorage.getItem(`reacted_${id}`)) return;
    const { error } = await supabase.from("reactions").insert({ curhat_id: id, type });
    if (!error) {
      localStorage.setItem(`reacted_${id}`, "1");
      loadCurhats();
    }
  };

  const shareLink = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#card-${id}`;
    if (navigator.share) {
      await navigator.share({ title: "Curhat Anonim", url });
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link disalin");
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

    const width = 560;
    const padding = 32;
    const lineHeight = 26;
    const fontSize = 16;

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

    const height = padding * 2 + lines.length * lineHeight + 48;
    canvas.width = width;
    canvas.height = height;

    if (currentTheme === "dark") {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#020617";
    }

    ctx.font = `${fontSize}px Inter, sans-serif`;
    lines.forEach((l, i) => {
      ctx.fillText(l, padding, padding + i * lineHeight + fontSize);
    });

    ctx.font = "12px Inter, sans-serif";
    ctx.globalAlpha = 0.6;
    ctx.fillText("Curhat Anonim", padding, height - 18);

    const img = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = img;
    a.download = "curhat.png";
    a.click();
  };

  return (
    <div className="page">
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
            {["😡", "😢", "🙂", "😄", "😭"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setText((prev) => prev + emoji);
                }}
              >
                {emoji}
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

          <button id="kirim" className="btn-primary" onClick={sendCurhat}>
            Kirim Curhat
          </button>
        </section>

        <section id="list-curhat" className="list-curhat">
          {loading ? (
            <div className="empty-state">Memuat curhatan...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : curhats.length === 0 ? (
            <div className="empty-state">Belum ada curhatan. Jadi yang pertama bercerita!</div>
          ) : (
            curhats.map((row) => {
              const meta = moodMeta(row.mood);
              const counts: Record<string, number> = {};
              (row.reactions || []).forEach((r) => {
                if (r && r.type) {
                  counts[r.type] = (counts[r.type] || 0) + 1;
                }
              });

              return (
                <div className="item" id={`card-${row.id}`} key={row.id}>
                  <div className="item-header">
                    <div className="avatar">{row.emoji || "😶"}</div>
                    <div>
                      <div className="name">{row.name || "Anonim"}</div>
                      <span className="badge" style={{ background: meta.color }}>
                        {row.mood || "netral"}
                      </span>
                    </div>
                  </div>

                  <div className="text" id={`curhat-${row.id}`}>
                    {row.text}
                  </div>

                  <div className="reaction-summary">
                    {Object.entries(counts).length > 0
                      ? Object.entries(counts)
                        .map(([t, c]) => `${REACTIONS[t] || t} ${c}`)
                        .join(" · ")
                      : "Belum ada reaksi"}
                  </div>

                  <div className="reaction-bar">
                    {Object.entries(REACTIONS).map(([t, e]) => (
                      <button
                        key={t}
                        onClick={() => sendReaction(row.id, t)}
                        title={t}
                      >
                        {e}
                      </button>
                    ))}
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

      <footer className="footer">
        <p className="footer-text">Kalau tempat ini ngebantu kamu, dukung pengembangannya</p>
        <a
          href="https://saweria.co/dafbeatx"
          target="_blank"
          rel="noopener"
          className="footer-link"
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
