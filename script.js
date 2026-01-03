import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   SUPABASE CONFIG
========================= */
const SUPABASE_URL = "https://fwhdjqvtjzesbdcqorsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_rwh41NF8iwUaRXL8A6t05g_sK7k5JL3";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================
   ELEMENTS
========================= */
const textarea = document.getElementById("curhat-input");
const sendBtn  = document.getElementById("kirim");
const list     = document.getElementById("list-curhat");

/* =========================
   STATE
========================= */
const COOLDOWN_MS = 30_000;

/* =========================
   AUDIO (GENERATED, NO FILE)
========================= */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSendSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + 0.12
  );

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.12);
}

/* =========================
   MOOD DETECTION (SMARTER)
========================= */
function detectMood(text) {
  const t = text.toLowerCase();

  if (/anjing|bangsat|kontol|tai|benci|muak|emosi|marah/.test(t)) return "marah";
  if (/sedih|capek|lelah|nangis|kecewa|hancur|putus/.test(t)) return "sedih";
  if (/senang|bahagia|lega|syukur|akhirnya|tenang/.test(t)) return "bahagia";
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
   IDENTITY (LOCAL, CONSISTENT)
========================= */
function getIdentity(text) {
  const saved = localStorage.getItem("curhat_identity");
  if (saved) return JSON.parse(saved);

  const mood = detectMood(text);
  const meta = moodMeta(mood);

  const identity = {
    name: meta.name,
    emoji: meta.emoji,
    mood
  };

  localStorage.setItem("curhat_identity", JSON.stringify(identity));
  return identity;
}

/* =========================
   ANTI SPAM
========================= */
function canSend() {
  const last = localStorage.getItem("last_send");
  return !last || Date.now() - Number(last) > COOLDOWN_MS;
}

function markSend() {
  localStorage.setItem("last_send", Date.now());
}

/* =========================
   SEND CURHAT
========================= */
sendBtn.addEventListener("click", sendCurhat);

textarea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendCurhat();
  }
});

async function sendCurhat() {
  const text = textarea.value.trim();
  if (!text) return;

  if (!canSend()) {
    alert("Pelan-pelan. Tunggu sebentar.");
    return;
  }

  const identity = getIdentity(text);

  const { error } = await supabase.from("curhat").insert({
    text,
    name: identity.name,
    emoji: identity.emoji,
    mood: identity.mood
  });

  if (error) {
    console.error(error);
    alert("Gagal mengirim curhat");
    return;
  }

  // audio feedback (generated)
  if (audioCtx.state === "suspended") {
    audioCtx.resume().then(playSendSound);
  } else {
    playSendSound();
  }

  textarea.value = "";
  markSend();
}

/* =========================
   LOAD CURHAT + REACTIONS
========================= */
async function loadCurhat() {
  const { data, error } = await supabase
    .from("curhat")
    .select(`
      *,
      reactions ( type )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  renderCurhat(data);
}

/* =========================
   RENDER
========================= */
function renderCurhat(data) {
  list.innerHTML = "";

  data.forEach(row => {
    const meta = moodMeta(row.mood || "netral");
    const reactions = countReactions(row.reactions || []);
    const reacted = localStorage.getItem(`reacted_${row.id}`);

    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <div class="item-header">
        <div class="avatar" style="background:${meta.color}22">
          ${row.emoji || meta.emoji}
        </div>
        <div>
          <div class="name">${row.name || "anonim"}</div>
          <span class="badge" style="background:${meta.color}">
            ${row.mood}
          </span>
        </div>
      </div>

      <div class="text">${escapeHtml(row.text)}</div>

      <div class="reaction-summary">
        ${renderReactionSummary(reactions)}
      </div>

      ${reacted ? "" : renderReactionButtons(row.id)}
    `;

    list.appendChild(div);
  });
}

/* =========================
   REACTIONS (EMPATIK)
========================= */
const REACTION_MAP = {
  read: "🤍",
  hug: "🫂",
  hope: "🌱",
  pray: "🙏",
  listen: "🕯️"
};

function renderReactionButtons(curhatId) {
  return `
    <div class="reaction-bar">
      ${Object.entries(REACTION_MAP)
        .map(
          ([type, emoji]) =>
            `<button onclick="sendReaction('${curhatId}','${type}')">${emoji}</button>`
        )
        .join("")}
    </div>
  `;
}

async function sendReaction(curhatId, type) {
  if (localStorage.getItem(`reacted_${curhatId}`)) return;

  const { error } = await supabase.from("reactions").insert({
    curhat_id: curhatId,
    type
  });

  if (error) {
    console.error(error);
    return;
  }

  localStorage.setItem(`reacted_${curhatId}`, "1");
  loadCurhat();
}

window.sendReaction = sendReaction;

function countReactions(rows) {
  const result = {};
  rows.forEach(r => {
    result[r.type] = (result[r.type] || 0) + 1;
  });
  return result;
}

function renderReactionSummary(counts) {
  return Object.entries(counts)
    .map(([type, count]) => `${REACTION_MAP[type]} ${count}`)
    .join(" · ");
}

/* =========================
   UTILS
========================= */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* =========================
   REALTIME
========================= */
supabase
  .channel("realtime-curhat")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "curhat" },
    loadCurhat
  )
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "reactions" },
    loadCurhat
  )
  .subscribe();

/* =========================
   INIT
========================= */
loadCurhat();
/* =========================
   THEME TOGGLE (FIX FINAL)
========================= */
const themeFab = document.querySelector(".theme-fab");
const root = document.documentElement;

// load saved theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  root.setAttribute("data-theme", savedTheme);
  themeFab.textContent = savedTheme === "dark" ? "☀️" : "🌙";
}

themeFab.addEventListener("click", () => {
  const current = root.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";

  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);

  themeFab.textContent = next === "dark" ? "☀️" : "🌙";
});
