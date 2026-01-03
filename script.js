import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   SUPABASE
========================= */
const supabase = createClient(
  "https://fwhdjqvtjzesbdcqorsn.supabase.co",
  "sb_publishable_rwh41NF8iwUaRXL8A6t05g_sK7k5JL3"
);

/* =========================
   ELEMENT
========================= */
const textarea = document.getElementById("curhat-input");
const sendBtn = document.getElementById("kirim");
const list = document.getElementById("list-curhat");
const emojiBar = document.getElementById("emoji-bar");

/* =========================
   TEXT NORMALIZER
========================= */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\b(gw|gua|gue)\b/g, "saya")
    .replace(/\bbgt\b/g, "banget")
    .replace(/\bgak\b|\bga\b/g, "tidak")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   MOOD ENGINE
========================= */
const MOOD_LEXICON = {
  marah: {
    words: {
      marah: 3, kesel: 3, emosi: 3, benci: 3,
      muak: 3, anjing: 4, bangsat: 4
    }
  },
  sedih: {
    words: {
      sedih: 3, capek: 3, lelah: 3, males: 3,
      kosong: 3, sendiri: 2, "pengen nyerah": 4
    }
  },
  bahagia: {
    words: {
      senang: 3, bahagia: 4, lega: 3,
      akhirnya: 2, tenang: 3, bersyukur: 3
    }
  }
};

function detectMood(text) {
  const t = normalizeText(text);
  const score = { marah: 0, sedih: 0, bahagia: 0 };

  for (const mood in MOOD_LEXICON) {
    for (const key in MOOD_LEXICON[mood].words) {
      if (t.includes(key)) {
        score[mood] += MOOD_LEXICON[mood].words[key];
      }
    }
  }

  const [topMood, topScore] =
    Object.entries(score).sort((a, b) => b[1] - a[1])[0];

  return topScore >= 3 ? topMood : "netral";
}

/* =========================
   IDENTITY (STABLE)
========================= */
const IDENTITY_KEY = "curhat_identity_final";

const ID_POOL = [
  { name: "si penasaran", emoji: "👀" },
  { name: "si kuat", emoji: "💪" },
  { name: "si bertahan", emoji: "🌱" },
  { name: "si jujur", emoji: "📝" }
];

function getIdentity() {
  const saved = localStorage.getItem(IDENTITY_KEY);
  if (saved) return JSON.parse(saved);

  const pick = ID_POOL[Math.floor(Math.random() * ID_POOL.length)];
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(pick));
  return pick;
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

emojiBar?.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    textarea.value += btn.textContent;
    textarea.focus();
  });
});

async function sendCurhat() {
  const text = textarea.value.trim();
  if (!text) return;

  const mood = detectMood(text);
  const identity = getIdentity();

  // 🔥 RENDER DENGAN HIGHLIGHT
  renderOne({
    text,
    mood,
    name: identity.name,
    emoji: identity.emoji
  }, { highlight: true });

  textarea.value = "";

  await supabase.from("curhat").insert({
    text,
    mood,
    name: identity.name,
    emoji: identity.emoji
  });
}

/* =========================
   RENDER
========================= */
function moodColor(mood) {
  return {
    marah: "#ef4444",
    sedih: "#3b82f6",
    bahagia: "#22c55e",
    netral: "#64748b"
  }[mood];
}

function renderOne(row, options = {}) {
  const color = moodColor(row.mood);
  const div = document.createElement("div");
  div.className = "item";

  div.innerHTML = `
    <div class="item-header">
      <div class="avatar" style="background:${color}22">${row.emoji}</div>
      <div>
        <div class="name">${row.name}</div>
        <span class="badge" style="background:${color}">
          ${row.mood}
        </span>
      </div>
    </div>
    <div class="text">${row.text}</div>
  `;

  // 🔥 HIGHLIGHT CURHAT SENDIRI
  if (options.highlight) {
    div.style.boxShadow = `0 0 0 2px ${color}55, 0 12px 30px ${color}33`;
    div.style.transition = "box-shadow .4s ease";

    setTimeout(() => {
      div.style.boxShadow = "";
    }, 2500);
  }

  list.prepend(div);
}

/* =========================
   LOAD & REALTIME
========================= */
async function loadCurhat() {
  const { data } = await supabase
    .from("curhat")
    .select("*")
    .order("created_at", { ascending: false });

  list.innerHTML = "";
  data.forEach(row => renderOne(row));
}

supabase
  .channel("realtime-curhat")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "curhat" },
    payload => {
      // ❌ JANGAN highlight realtime orang lain
      renderOne(payload.new);
    }
  )
  .subscribe();

/* =========================
   INIT
========================= */
loadCurhat();
/* =========================
   THEME TOGGLE (VERCEL SAFE)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const themeBtn = document.getElementById("theme-toggle");
  const root = document.documentElement;

  if (!themeBtn) {
    console.warn("Theme button not found");
    return;
  }

  // load saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    root.setAttribute("data-theme", savedTheme);
    themeBtn.textContent = savedTheme === "dark" ? "☀️" : "🌙";
  }

  // toggle
  themeBtn.addEventListener("click", () => {
    const currentTheme =
      root.getAttribute("data-theme") === "dark" ? "light" : "dark";

    root.setAttribute("data-theme", currentTheme);
    localStorage.setItem("theme", currentTheme);
    themeBtn.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  });
});
