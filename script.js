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
const root = document.documentElement;
const themeFab = document.querySelector(".theme-fab");

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
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function playSendSound() {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.value = 220;
  g.gain.value = 0.12;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.12);
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

  const { error } = await supabase.from("curhat").insert({
    text,
    mood,
    emoji: meta.emoji,
    name: meta.name
  });

  if (error) return alert("Gagal kirim");

  playSendSound();
  textarea.value = "";
  loadCurhat();
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
      <div class="item" id="card-${r.id}">
        <div class="item-header">
          <div class="avatar">${meta.emoji}</div>
          <div>
            <div class="name">${r.name}</div>
            <span class="badge" style="background:${meta.color}">${r.mood}</span>
          </div>
        </div>

        <div class="text">${escapeHtml(r.text)}</div>

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
          <button class="icon-btn share" onclick="shareAsImage('${r.id}')"></button>
          <button class="icon-btn image" onclick="downloadAsImage('${r.id}')"></button>
        </div>
      </div>
    `;
  });
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

/* =========================
   SHARE AS IMAGE (WHATSAPP STYLE)
========================= */
async function createImageFromCard(card) {
  const dark = root.getAttribute("data-theme") === "dark";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const width = 540;
  const padding = 32;
  const textEl = card.querySelector(".text");
  const text = textEl.innerText.trim();

  ctx.font = "16px Inter, sans-serif";
  const words = text.split(" ");
  let lines = [], line = "";

  words.forEach(w => {
    const test = line + w + " ";
    if (ctx.measureText(test).width > width - padding*2) {
      lines.push(line);
      line = w + " ";
    } else line = test;
  });
  lines.push(line);

  const height = padding*2 + lines.length*26 + 80;
  canvas.width = width;
  canvas.height = height;

  // background
  ctx.fillStyle = dark ? "#020617" : "#ffffff";
  ctx.fillRect(0,0,width,height);

  // subtle grid
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  for (let i=0;i<width;i+=32){
    ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,height); ctx.stroke();
  }
  for (let i=0;i<height;i+=32){
    ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(width,i); ctx.stroke();
  }

  // text
  ctx.fillStyle = dark ? "#ffffff" : "#111827";
  ctx.font = "16px Inter, sans-serif";
  lines.forEach((l,i)=>{
    ctx.fillText(l, padding, padding + i*26);
  });

  // watermark
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)";
  ctx.fillText("Curhat Anonim", padding, height-20);

  return canvas;
}

window.shareAsImage = async (id) => {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;

  const canvas = await createImageFromCard(card);
  const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
  const file = new File([blob], "curhat.png", { type:"image/png" });

  if (navigator.share && navigator.canShare({ files:[file] })) {
    await navigator.share({ files:[file], title:"Curhat Anonim" });
  } else {
    downloadBlob(blob);
  }
};

window.downloadAsImage = async (id) => {
  const card = document.getElementById(`card-${id}`);
  const canvas = await createImageFromCard(card);
  canvas.toBlob(downloadBlob);
};

function downloadBlob(blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "curhat.png";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* =========================
   THEME
========================= */
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  root.setAttribute("data-theme", savedTheme);
  themeFab.textContent = savedTheme === "dark" ? "☀️" : "🌙";
}

themeFab.onclick = () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeFab.textContent = next === "dark" ? "☀️" : "🌙";
};

/* =========================
   REALTIME
========================= */
supabase.channel("rt")
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"curhat"},loadCurhat)
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"reactions"},loadCurhat)
  .subscribe();

loadCurhat();