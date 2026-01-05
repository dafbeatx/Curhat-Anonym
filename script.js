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
const themeFab = document.querySelector(".theme-fab");
const root = document.documentElement;

/* =========================
   THEME (DARK / LIGHT)
========================= */
const savedTheme = localStorage.getItem("theme") || "light";
root.setAttribute("data-theme", savedTheme);
if (themeFab) themeFab.textContent = savedTheme === "dark" ? "☀️" : "🌙";

themeFab?.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeFab.textContent = next === "dark" ? "☀️" : "🌙";
});

/* =========================
   EVENT
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
function playSendSound() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
  btn.addEventListener("click", () => {
    textarea.value += btn.textContent;
    textarea.focus();
  });
});

/* =========================
   MOOD
========================= */
function detectMood(text) {
  const t = text.toLowerCase();
  if (/anjing|bangsat|emosi|marah/.test(t)) return "marah";
  if (/sedih|capek|nangis|lelah/.test(t)) return "sedih";
  if (/senang|bahagia|lega|syukur/.test(t)) return "bahagia";
  return "netral";
}

function moodMeta(mood) {
  return {
    marah:   { emoji: "😡", color: "#ef4444", name: "si pemarah" },
    sedih:   { emoji: "😢", color: "#3b82f6", name: "si capek hidup" },
    bahagia: { emoji: "😄", color: "#22c55e", name: "si paling bahagia" },
    netral:  { emoji: "🙂", color: "#64748b", name: "si anonim" }
  }[mood];
}

/* =========================
   SEND CURHAT
========================= */
async function sendCurhat() {
  const text = textarea.value.trim();
  if (!text) return;

  const mood = detectMood(text);
  const meta = moodMeta(mood);

  const { error } = await supabase.from("curhat").insert({
    text,
    mood,
    emoji: meta.emoji,
    name: meta.name
  });

  if (error) {
    alert("Gagal mengirim curhat");
    return;
  }

  playSendSound();
  textarea.value = "";
  loadCurhat();
}

/* =========================
   REACTIONS
========================= */
const REACTIONS = {
  read: "🤍",
  hug: "🫂",
  hope: "🌱",
  pray: "🙏",
  listen: "🕯️"
};

window.sendReaction = async (id, type) => {
  if (localStorage.getItem(`reacted_${id}`)) return;
  await supabase.from("reactions").insert({ curhat_id: id, type });
  localStorage.setItem(`reacted_${id}`, "1");
  loadCurhat();
};

/* =========================
   LOAD & RENDER
========================= */
async function loadCurhat() {
  const { data } = await supabase
    .from("curhat")
    .select("*, reactions(type)")
    .order("created_at", { ascending: false });

  renderCurhat(data || []);
}

function renderCurhat(rows) {
  list.innerHTML = "";

  rows.forEach(row => {
    const meta = moodMeta(row.mood);
    const counts = {};
    (row.reactions || []).forEach(r => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });

    list.innerHTML += `
      <div class="item" id="card-${row.id}">
        <div class="item-header">
          <div class="avatar">${row.emoji}</div>
          <div>
            <div class="name">${row.name}</div>
            <span class="badge" style="background:${meta.color}">${row.mood}</span>
          </div>
        </div>

        <div class="text" id="curhat-${row.id}">${escapeHtml(row.text)}</div>

        <div class="reaction-summary">
          ${Object.entries(counts).map(([t,c]) => `${REACTIONS[t]} ${c}`).join(" · ")}
        </div>

        <div class="reaction-bar">
          ${Object.entries(REACTIONS)
            .map(([t,e]) => `<button onclick="sendReaction('${row.id}','${t}')">${e}</button>`)
            .join("")}
        </div>

        <div class="card-actions">
  <button
    class="icon-btn share"
    aria-label="Bagikan"
    onclick="shareLink('${row.id}')">
  </button>

  <button
    class="icon-btn image"
    aria-label="Simpan sebagai gambar"
    onclick="shareAsImage('${row.id}')">
  </button>
</div>
      </div>
    `;
  });
}

/* =========================
   SHARE LINK
========================= */
window.shareLink = async id => {
  const url = `${location.origin}${location.pathname}#curhat-${id}`;
  if (navigator.share) {
    await navigator.share({ title: "Curhat Anonim", url });
  } else {
    await navigator.clipboard.writeText(url);
    alert("Link disalin");
  }
};

/* =========================
   SHARE AS IMAGE (PRESISI)
========================= */
window.shareAsImage = async id => {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;

  const text = card.querySelector(".text").innerText;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const width = 560;
  const padding = 32;
  const lineHeight = 26;
  const fontSize = 16;

  ctx.font = `${fontSize}px Inter, sans-serif`;

  // word wrap
  const words = text.split(" ");
  let lines = [];
  let line = "";

  words.forEach(w => {
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

  // background (match dark card)
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);

  // rounded border illusion
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // text
  ctx.fillStyle = "#ffffff";
  ctx.font = `${fontSize}px Inter, sans-serif`;
  lines.forEach((l, i) => {
    ctx.fillText(l, padding, padding + i * lineHeight);
  });

  // watermark
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("Curhat Anonim", padding, height - 18);

  const img = canvas.toDataURL("image/png");

  const a = document.createElement("a");
  a.href = img;
  a.download = "curhat.png";
  a.click();
};

/* =========================
   UTILS
========================= */
function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

/* =========================
   REALTIME
========================= */
supabase.channel("realtime")
  .on("postgres_changes", { event: "INSERT", table: "curhat" }, loadCurhat)
  .on("postgres_changes", { event: "INSERT", table: "reactions" }, loadCurhat)
  .subscribe();

loadCurhat();