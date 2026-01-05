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
   EVENT
========================= */
sendBtn.onclick = sendCurhat;
textarea.onkeydown = e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendCurhat();
  }
};

/* =========================
   AUDIO
========================= */
let audioCtx;
function playSound() {
  if (!audioCtx) audioCtx = new AudioContext();
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
document.querySelectorAll(".emoji-bar button").forEach(b => {
  b.onclick = () => {
    textarea.value += b.textContent;
    textarea.focus();
  };
});

/* =========================
   MOOD
========================= */
function detectMood(t) {
  t = t.toLowerCase();
  if (/anjing|bangsat|marah|emosi/.test(t)) return "marah";
  if (/sedih|capek|nangis/.test(t)) return "sedih";
  if (/senang|bahagia|syukur/.test(t)) return "bahagia";
  return "netral";
}
function moodMeta(m) {
  return {
    marah:{emoji:"😡",color:"#ef4444",name:"si pemarah"},
    sedih:{emoji:"😢",color:"#3b82f6",name:"si capek hidup"},
    bahagia:{emoji:"😄",color:"#22c55e",name:"si paling bahagia"},
    netral:{emoji:"🙂",color:"#64748b",name:"si anonim"}
  }[m];
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
    alert("Gagal kirim");
    return;
  }

  playSound();
  textarea.value = "";
  loadCurhat();
}

/* =========================
   REACTIONS
========================= */
const REACT = { read:"🤍", hug:"🫂", hope:"🌱", pray:"🙏", listen:"🕯️" };
window.sendReaction = async (id, type) => {
  if (localStorage.getItem("r_"+id)) return;
  await supabase.from("reactions").insert({ curhat_id:id, type });
  localStorage.setItem("r_"+id,1);
  loadCurhat();
};

/* =========================
   LOAD + RENDER
========================= */
async function loadCurhat() {
  const { data } = await supabase
    .from("curhat")
    .select("*, reactions(type)")
    .order("created_at",{ascending:false});
  renderCurhat(data||[]);
}

function renderCurhat(rows) {
  list.innerHTML = "";
  rows.forEach(r => {
    const meta = moodMeta(r.mood);
    const counts = {};
    (r.reactions||[]).forEach(x=>counts[x.type]=(counts[x.type]||0)+1);

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
          ${Object.entries(counts).map(([t,c])=>`${REACT[t]} ${c}`).join(" · ")}
        </div>

        <div class="reaction-bar">
          ${Object.entries(REACT).map(([t,e])=>
            `<button onclick="sendReaction('${r.id}','${t}')">${e}</button>`
          ).join("")}
        </div>

        <div class="card-actions">
          <button onclick="shareLink('${r.id}')">🔗</button>
          <button onclick="shareImage('${r.id}')">🖼️</button>
        </div>
      </div>`;
  });
}

/* =========================
   SHARE LINK
========================= */
window.shareLink = async id => {
  const url = `${location.origin}${location.pathname}#curhat-${id}`;
  if (navigator.share) {
    await navigator.share({ title:"Curhat Anonim", url });
  } else {
    await navigator.clipboard.writeText(url);
    alert("Link disalin");
  }
};

/* =========================
   SHARE IMAGE (CANVAS)
========================= */
window.shareImage = async id => {
  const el = document.getElementById("curhat-"+id);
  if (!el) return;

  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  c.width = 520;
  c.height = 360;
  ctx.fillStyle = "#020617";
  ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle = "#fff";
  ctx.font = "16px Inter";
  wrapText(ctx, el.innerText, 30, 60, 460, 26);
  ctx.font = "12px Inter";
  ctx.fillText("Curhat Anonim",30,c.height-20);

  const url = c.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "curhat.png";
  a.click();
};

function wrapText(ctx,text,x,y,maxW,lh){
  text.split("\n").forEach(p=>{
    let line="";
    p.split(" ").forEach(w=>{
      const t=line+w+" ";
      if(ctx.measureText(t).width>maxW){
        ctx.fillText(line,x,y);
        line=w+" "; y+=lh;
      } else line=t;
    });
    ctx.fillText(line,x,y); y+=lh;
  });
}

/* =========================
   REALTIME
========================= */
supabase.channel("rt")
  .on("postgres_changes",{event:"INSERT",table:"curhat"},loadCurhat)
  .on("postgres_changes",{event:"INSERT",table:"reactions"},loadCurhat)
  .subscribe();

loadCurhat();