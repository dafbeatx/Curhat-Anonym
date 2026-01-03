import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   SUPABASE
========================= */
const SUPABASE_URL = "https://fwhdjqvtjzesbdcqorsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_rwh41NF8iwUaRXL8A6t05g_sK7k5JL3";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================
   ELEMENTS
========================= */
const textarea = document.getElementById("curhat-input");
const sendBtn = document.getElementById("kirim");
const list = document.getElementById("list-curhat");

/* =========================
   AUDIO
========================= */
let audioCtx;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playSendSound() {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.value = 220;

  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.12);
}

/* =========================
   EMOJI BAR CLICK
========================= */
document.querySelectorAll(".emoji-bar button").forEach(btn => {
  btn.addEventListener("click", () => {
    initAudio();
    textarea.focus();

    const emoji = btn.textContent;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    textarea.value =
      textarea.value.slice(0, start) + emoji + textarea.value.slice(end);

    textarea.selectionStart = textarea.selectionEnd =
      start + emoji.length;
  });
});

/* =========================
   MOOD
========================= */
function detectMood(text) {
  const t = text.toLowerCase();
  if (/anjing|bangsat|benci|emosi|marah/.test(t)) return "marah";
  if (/sedih|capek|lelah|nangis|kecewa/.test(t)) return "sedih";
  if (/senang|bahagia|lega|syukur/.test(t)) return "bahagia";
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
   IDENTITY
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
  initAudio();

  const text = textarea.value.trim();
  if (!text) return;

  const identity = getIdentity(text);

  const { error } = await supabase.from("curhat").insert({
    text,
    name: identity.name,
    emoji: identity.emoji,
    mood: identity.mood
  });

  if (error) {
    console.error(error);
    return;
  }

  playSendSound();
  textarea.value = "";
}

/* =========================
   REACTIONS
========================= */
const REACTION_MAP = {
  read: "🤍",
  hug: "🫂",
  hope: "🌱",
  pray: "🙏",
  listen: "🕯️"
};

async function sendReaction(curhatId, type) {
  if (localStorage.getItem(`reacted_${curhatId}`)) return;

  await supabase.from("reactions").insert({
    curhat_id: curhatId,
    type
  });

  localStorage.setItem(`reacted_${curhatId}`, "1");
  loadCurhat();
}

window.sendReaction = sendReaction;

function countReactions(rows) {
  const out = {};
  rows.forEach(r => {
    out[r.type] = (out[r.type] || 0) + 1;
  });
  return out;
}

/* =========================
   LOAD + RENDER
========================= */
async function loadCurhat() {
  const { data } = await supabase
    .from("curhat")
    .select(`
      *,
      reactions ( type )
    `)
    .order("created_at", { ascending: false });

  renderCurhat(data || []);
}

function renderCurhat(data) {
  list.innerHTML = "";

  data.forEach(row => {
    const meta = moodMeta(row.mood || "netral");
    const reacted = localStorage.getItem(`reacted_${row.id}`);
    const counts = countReactions(row.reactions || []);

    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <div class="item-header">
        <div class="avatar" style="background:${meta.color}22">${row.emoji}</div>
        <div>
          <div class="name">${row.name}</div>
          <span class="badge" style="background:${meta.color}">${row.mood}</span>
        </div>
      </div>

      <div class="text">${escapeHtml(row.text)}</div>

      <div class="reaction-summary">
        ${Object.entries(counts)
          .map(([t, c]) => `${REACTION_MAP[t]} ${c}`)
          .join(" · ")}
      </div>

      ${
        reacted
          ? ""
          : `<div class="reaction-bar">
              ${Object.entries(REACTION_MAP)
                .map(
                  ([t, e]) =>
                    `<button onclick="sendReaction('${row.id}','${t}')">${e}</button>`
                )
                .join("")}
            </div>`
      }
    `;

    list.appendChild(div);
  });
}

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
supabase
  .channel("realtime-all")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "curhat" }, loadCurhat)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, loadCurhat)
  .subscribe();

/* =========================
   INIT
========================= */
loadCurhat();
