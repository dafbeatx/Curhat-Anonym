import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   SUPABASE
========================= */
const supabase = createClient(
  "https://fwhdjqvtjzesbdcqorsn.supabase.co",
  "sb_publishable_rwh41NF8iwUaRXL8A6t05g_sK7k5JL3"
);

/* =========================
   ELEMENTS
========================= */
const textarea = document.getElementById("curhat-input");
const sendBtn = document.getElementById("kirim");
const list = document.getElementById("list-curhat");

/* =========================
   EVENT BINDING
========================= */
sendBtn.addEventListener("click", sendCurhat);
textarea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendCurhat();
  }
});

/* =========================
   AUDIO
========================= */
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function playSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = 220;
  gain.gain.value = 0.12;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.12);
}

/* =========================
   EMOJI BAR
========================= */
document.querySelectorAll(".emoji-bar button").forEach(btn => {
  btn.onclick = () => {
    initAudio();
    textarea.value += btn.textContent;
    textarea.focus();
  };
});

/* =========================
   MOOD
========================= */
function detectMood(text) {
  const t = text.toLowerCase();
  if (/anjing|bangsat|marah|emosi/.test(t)) return "marah";
  if (/sedih|capek|nangis/.test(t)) return "sedih";
  if (/senang|bahagia|syukur/.test(t)) return "bahagia";
  return "netral";
}
function moodMeta(mood) {
  return {
    marah: { emoji: "😡", color: "#ef4444", name: "si pemarah" },
    sedih: { emoji: "😢", color: "#3b82f6", name: "si capek hidup" },
    bahagia: { emoji: "😄", color: "#22c55e", name: "si paling bahagia" },
    netral: { emoji: "🙂", color: "#64748b", name: "si anonim" }
  }[mood];
}

/* =========================
   SEND CURHAT
========================= */
async function sendCurhat() {
  initAudio();
  const text = textarea.value.trim();
  if (!text) return;

  const mood = detectMood(text);
  const meta = moodMeta(mood);

  await supabase.from("curhat").insert({
    text,
    mood,
    emoji: meta.emoji,
    name: meta.name
  });

  playSound();
  textarea.value = "";
  loadCurhat(); // optimistic refresh
}

/* =========================
   REACTIONS
========================= */
const REACTION_MAP = { read:"🤍", hug:"🫂", hope:"🌱", pray:"🙏", listen:"🕯️" };
window.sendReaction = async (id, type) => {
  if (localStorage.getItem(`reacted_${id}`)) return;
  await supabase.from("reactions").insert({ curhat_id:id, type });
  localStorage.setItem(`reacted_${id}`, 1);
  loadCurhat();
};

/* =========================
   LOAD & RENDER
========================= */
async function loadCurhat() {
  const { data } = await supabase
    .from("curhat")
    .select("*, reactions(type)")
    .order("created_at", { ascending:false });
  renderCurhat(data || []);
}

function renderCurhat(rows) {
  list.innerHTML = "";
  rows.forEach(r => {
    const meta = moodMeta(r.mood);
    const reacted = localStorage.getItem(`reacted_${r.id}`);
    const counts = {};
    (r.reactions||[]).forEach(x => counts[x.type]=(counts[x.type]||0)+1);

    list.innerHTML += `
      <div class="item">
        <div class="item-header">
          <div class="avatar">${meta.emoji}</div>
          <div>
            <div class="name">${r.name}</div>
            <span class="badge" style="background:${meta.color}">${r.mood}</span>
          </div>
        </div>

        <div class="text" id="curhat-${r.id}">${r.text}</div>

        <div class="reaction-summary">
          ${Object.entries(counts).map(([t,c])=>`${REACTION_MAP[t]} ${c}`).join(" · ")}
        </div>

        ${reacted?"":`
        <div class="reaction-bar">
          ${Object.entries(REACTION_MAP).map(([t,e])=>
            `<button onclick="sendReaction('${r.id}','${t}')">${e}</button>`
          ).join("")}
        </div>`}

<div class="card-actions">
  <button class="share-btn" onclick="shareCurhat('${row.id}')">🔗 Bagikan</button>
  <button class="share-btn" onclick="shareAsImage('${row.id}')">🖼️ Gambar</button>
</div>
      </div>`;
  });
}

async function shareCurhat(id) {
  const url = `${location.origin}${location.pathname}#curhat-${id}`;
  const text = encodeURIComponent("Curhatan anonim yang mungkin relate.");
async function shareAsImage(curhatId) {
  const el = document.getElementById(`curhat-${curhatId}`);
  if (!el) return alert("Curhat tidak ditemukan");

  const text = el.innerText.trim();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // ukuran canvas
  const padding = 40;
  const maxWidth = 520;
  const lineHeight = 26;
  const fontSize = 16;
  const font = `${fontSize}px Inter, sans-serif`;

  ctx.font = font;

  // word wrap
  const words = text.split(" ");
  let lines = [];
  let line = "";

  words.forEach(word => {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth - padding * 2) {
      lines.push(line);
      line = word + " ";
    } else {
      line = test;
    }
  });
  lines.push(line);

  const height =
    padding * 2 +
    lines.length * lineHeight +
    50;

  canvas.width = maxWidth;
  canvas.height = height;

  // background
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < canvas.width; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i < canvas.height; i += 32) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }

  // text
  ctx.fillStyle = "#ffffff";
  ctx.font = font;

  lines.forEach((l, i) => {
    ctx.fillText(l, padding, padding + i * lineHeight);
  });

  // watermark
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(
    "Curhat Anonim",
    padding,
    canvas.height - 20
  );

  const imageUrl = canvas.toDataURL("image/png");

  // share / download
  if (navigator.share && navigator.canShare) {
    const blob = await (await fetch(imageUrl)).blob();
    const file = new File([blob], "curhat.png", { type: "image/png" });

    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Curhat Anonim"
      });
      return;
    }
  }

  // fallback: download
  const a = document.createElement("a");
  a.href = imageUrl;
  a.download = "curhat.png";
  a.click();
}

window.shareAsImage = shareAsImage;

  // MOBILE SHARE (Android / iOS)
  if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({
        title: "Curhat Anonim",
        text: "Curhatan anonim yang mungkin relate.",
        url
      });
      return;
    } catch {
      // user cancel
    }
  }

  // DESKTOP FALLBACK (SELALU KELIATAN)
  const popup = document.createElement("div");
  popup.className = "share-popup";
  popup.innerHTML = `
    <div class="share-box">
      <p>Bagikan curhatan ini</p>
      <a href="https://wa.me/?text=${text}%20${encodeURIComponent(url)}" target="_blank">WhatsApp</a>
      <a href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}" target="_blank">Telegram</a>
      <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${text}" target="_blank">X / Twitter</a>
      <button id="copy-link">Salin Link</button>
      <button id="close-share">Tutup</button>
    </div>
  `;
  document.body.appendChild(popup);

  document.getElementById("copy-link").onclick = async () => {
    await navigator.clipboard.writeText(url);
    alert("Link disalin");
  };

  document.getElementById("close-share").onclick = () => popup.remove();
}

window.shareCurhat = shareCurhat;


/* =========================
   THEME
========================= */
const fab = document.querySelector(".theme-fab");
const root = document.documentElement;
const saved = localStorage.getItem("theme");
if (saved) root.dataset.theme = saved;

fab.onclick = () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  localStorage.setItem("theme", next);
};

/* =========================
   REALTIME
========================= */
supabase.channel("rt")
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"curhat"},loadCurhat)
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"reactions"},loadCurhat)
  .subscribe();

loadCurhat();