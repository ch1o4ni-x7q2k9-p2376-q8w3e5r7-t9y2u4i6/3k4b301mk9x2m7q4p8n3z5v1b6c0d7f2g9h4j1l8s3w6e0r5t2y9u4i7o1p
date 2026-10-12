/* ══════════════════════════════════════════════════════════════
   Our Story — with built-in editor
   Data is saved to localStorage + IndexedDB (photos)
   ══════════════════════════════════════════════════════════════ */

// ─── Default content (used on first load or after Reset) ───
const DEFAULTS = {
  heroSub: "A story written in moments",
  heroTitle: "Our Story",
  yourName: "Your Name",
  herName: "Her Name",
  startDateLabel: "Since January 1, 2023",
  startDate: "2023-01-01T20:00:00",
  quote: "\"In a world of temporary things, you are my forever.\"",
  timelineTitle: "Our Journey Together",
  timelineSub: "Every moment, every laugh, every tear",
  parallaxText: "You & Me",
  galleryTitle: "Moments We've Captured",
  letterGreeting: "My dearest,",
  letterBody: [
    "From the moment I met you, something in me knew. You walked in and suddenly everything felt right — like the universe had been saving you for just for me.",
    "Every day with you is a gift I don't take for granted. The way you laugh, the way you look at me, the way you make even the smallest moments feel like memories worth keeping.",
    "Thank you for choosing me. For your patience, your kindness, your warmth. Thank you for being the person I get to come home to.",
    "I love you more than any words on this page could ever say. And I will keep choosing you — every day, in every lifetime."
  ],
  letterSignature: "Forever yours",
  counterLabel: "We've been together for",
  finalTitle: "And this is just the beginning",
  finalText: "Every day with you is a gift. Here's to a thousand more memories.",
  surprise: "You are my favorite person, my safest place, my greatest adventure. I love you. ❤️",
  songTitle: "Our song",
  theme: "dark",

  moments: [
    { date: "January 2023", title: "The day we met", text: "I still remember exactly what you were wearing. I still remember how nervous I was. And I still remember thinking — this is different.", photo: null },
    { date: "February 2023", title: "Our first date", text: "I planned everything. It didn't go according to plan. It was better.", photo: null },
    { date: "March 2023", title: "The first 'I love you'", text: "I said it before I meant to. But I meant it more than anything I've ever said.", photo: null },
    { date: "Summer 2023", title: "That trip we still talk about", text: "The sunsets, the food, the ridiculous arguments about directions, the way you fell asleep on my shoulder.", photo: null },
    { date: "December 2023", title: "One year of us", text: "A whole year. And I'd do it all over again.", photo: null }
  ],
  gallery: [
    null, null, null, null, null, null, null, null
  ]
};

// ─── State ───
let state = loadState();

// ─── IndexedDB for photos + music (large files) ───
const DB_NAME = "ourstory-db";
const DB_VERSION = 1;
let idb = null;

function openDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
async function dbPut(key, blob) {
  if (!idb) idb = await openDB();
  if (!idb) return;
  return new Promise((resolve) => {
    const tx = idb.transaction("files", "readwrite");
    tx.objectStore("files").put(blob, key);
    tx.oncomplete = resolve;
  });
}
async function dbGet(key) {
  if (!idb) idb = await openDB();
  if (!idb) return null;
  return new Promise((resolve) => {
    const tx = idb.transaction("files", "readonly");
    const r = tx.objectStore("files").get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => resolve(null);
  });
}
async function dbDel(key) {
  if (!idb) idb = await openDB();
  if (!idb) return;
  return new Promise((resolve) => {
    const tx = idb.transaction("files", "readwrite");
    tx.objectStore("files").delete(key);
    tx.oncomplete = resolve;
  });
}

// ─── Save / load state ───
function loadState() {
  try {
    const raw = localStorage.getItem("ourstory-state");
    if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
    return { ...JSON.parse(JSON.stringify(DEFAULTS)), ...JSON.parse(raw) };
  } catch { return JSON.parse(JSON.stringify(DEFAULTS)); }
}
function saveState() {
  try {
    const toSave = { ...state };
    // photos in moments/gallery store refs like "img:id" — no need to strip
    localStorage.setItem("ourstory-state", JSON.stringify(toSave));
  } catch {}
}

// ─── Show a photo from an "img:id" ref or a URL ───
async function resolveImg(ref) {
  if (!ref) return null;
  if (typeof ref === "string" && ref.startsWith("img:")) {
    const id = ref.slice(4);
    const blob = await dbGet(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }
  return ref;
}

// ─── Toast ───
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.classList.add("hidden"), 300); }, 2200);
}

// ══════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════
function renderAll() {
  // editable text fields
  document.querySelectorAll(".editable").forEach(el => {
    const key = el.dataset.key;
    if (key && state[key] !== undefined) {
      // preserve nested spans (hero-names uses data-key on each .name)
      el.textContent = state[key];
    }
  });

  renderMoments();
  renderGallery();
  renderLetter();
  applyTheme(state.theme);
}

function renderMoments() {
  const wrap = document.getElementById("timeline");
  wrap.innerHTML = "";
  state.moments.forEach((m, i) => {
    const el = document.createElement("div");
    el.className = "moment";
    el.dataset.index = i;
    el.innerHTML = `
      <div class="moment-card">
        <button class="moment-remove" title="Remove">✕</button>
        <div class="image-picker" data-img-pick="moment" data-index="${i}">📷 Click to add photo</div>
        <img class="moment-img" alt="" style="display:none">
        <span class="moment-date editable" data-key="moments.${i}.date">${escapeHtml(m.date)}</span>
        <h3 class="moment-title editable" data-key="moments.${i}.title">${escapeHtml(m.title)}</h3>
        <p class="moment-text editable" data-key="moments.${i}.text">${escapeHtml(m.text)}</p>
      </div>
      <div class="moment-dot"></div>
    `;
    wrap.appendChild(el);
    // load photo if any
    if (m.photo) {
      resolveImg(m.photo).then(url => {
        if (url) {
          const img = el.querySelector(".moment-img");
          img.src = url;
          img.style.display = "block";
        }
      });
    }
    // wire editable
    el.querySelectorAll(".editable").forEach(bindEditable);
  });

  // wire remove buttons + image pickers
  wrap.querySelectorAll(".moment-remove").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = +e.target.closest(".moment").dataset.index;
      if (!confirm("Remove this moment?")) return;
      state.moments.splice(idx, 1);
      saveState(); renderMoments(); renderAll();
    };
  });
  wrap.querySelectorAll('[data-img-pick="moment"]').forEach(p => {
    p.onclick = (e) => {
      e.stopPropagation();
      const idx = +p.dataset.index;
      pickImage((ref) => {
        state.moments[idx].photo = ref;
        saveState(); renderMoments();
      });
    };
  });
}

async function renderGallery() {
  const wrap = document.getElementById("gallery");
  wrap.innerHTML = "";
  for (let i = 0; i < state.gallery.length; i++) {
    const ref = state.gallery[i];
    const el = document.createElement("div");
    el.className = "gallery-item";
    el.dataset.index = i;
    el.innerHTML = `
      <button class="gallery-remove" title="Remove">✕</button>
      <div class="image-picker" data-img-pick="gallery" data-index="${i}">📷 ${ref ? "Change" : "Add"} photo</div>
      <img alt="" style="display:${ref ? "block" : "none"}">
    `;
    wrap.appendChild(el);
    if (ref) {
      const url = await resolveImg(ref);
      if (url) {
        const img = el.querySelector("img");
        img.src = url;
        img.onclick = () => openLightbox(url);
      }
    }
    el.querySelector(".gallery-remove").onclick = (e) => {
      e.stopPropagation();
      state.gallery.splice(i, 1);
      saveState(); renderGallery();
    };
    el.querySelector('[data-img-pick="gallery"]').onclick = (e) => {
      e.stopPropagation();
      pickImage((ref) => {
        state.gallery[i] = ref;
        saveState(); renderGallery();
      });
    };
  }
}

function renderLetter() {
  const body = document.getElementById("letterBody");
  body.innerHTML = "";
  state.letterBody.forEach((p, i) => {
    const el = document.createElement("p");
    el.className = "editable";
    el.dataset.key = `letterBody.${i}`;
    el.textContent = p;
    bindEditable(el);
    body.appendChild(el);
  });
  // wire letter greeting + signature too (they use data-key already)
}

// ══════════════════════════════════════════════════════════════
// EDITOR — text editing
// ══════════════════════════════════════════════════════════════
function bindEditable(el) {
  // avoid double binding
  if (el.dataset.bound) return;
  el.dataset.bound = "1";

  el.addEventListener("click", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;
    e.stopPropagation();
    el.contentEditable = "true";
    el.focus();
  });

  el.addEventListener("blur", () => {
    if (!document.body.classList.contains("edit-mode")) return;
    el.contentEditable = "false";
    const key = el.dataset.key;
    const value = el.textContent.trim();
    setByPath(state, key, value);
    saveState();
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      el.blur();
    }
  });
}

// set nested state value: "moments.0.title" or "letterBody.2"
function setByPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

// ══════════════════════════════════════════════════════════════
// EDITOR — image picker
// ══════════════════════════════════════════════════════════════
function pickImage(cb) {
  const input = document.getElementById("fileInput");
  input.value = "";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const id = "img:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);
    await dbPut(id, file);
    cb(id);
    toast("Photo added ✓");
  };
  input.click();
}

// ══════════════════════════════════════════════════════════════
// EDITOR — toolbar
// ══════════════════════════════════════════════════════════════
function openEditor() {
  document.body.classList.add("edit-mode");
  document.getElementById("editToolbar").classList.add("open");
  toast("Edit mode on — click any text to edit");
}
function closeEditor() {
  document.body.classList.remove("edit-mode");
  document.getElementById("editToolbar").classList.remove("open");
  saveState();
  toast("Saved ✓");
}

function addMoment() {
  state.moments.push({ date: "Month Year", title: "New moment", text: "Write your story here...", photo: null });
  saveState();
  renderMoments();
  // scroll to it
  setTimeout(() => {
    const els = document.querySelectorAll(".moment");
    els[els.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}

function addGalleryPhoto() {
  state.gallery.push(null);
  saveState();
  renderGallery().then(() => {
    // open picker immediately
    const i = state.gallery.length - 1;
    pickImage((ref) => {
      state.gallery[i] = ref;
      saveState(); renderGallery();
    });
  });
}

function changeMusic() {
  const input = document.getElementById("musicInput");
  input.value = "";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    await dbPut("music:main", file);
    const url = URL.createObjectURL(file);
    const audio = document.getElementById("bgMusic");
    audio.src = url;
    state.songTitle = file.name.replace(/\.[^.]+$/, "");
    document.getElementById("musicTitle").textContent = state.songTitle;
    // store title, and mark that a custom song exists
    state.hasCustomSong = true;
    saveState();
    audio.play().then(() => document.getElementById("musicPlayer").classList.add("playing")).catch(() => {});
    toast("Our song updated ♪");
  };
  input.click();
}

function pickTheme() {
  const themes = ["dark", "rose", "midnight", "cream"];
  const choice = prompt("Theme? Type: dark, rose, midnight, cream", state.theme || "dark");
  if (themes.includes(choice)) {
    state.theme = choice;
    applyTheme(choice);
    saveState();
    toast("Theme: " + choice);
  }
}

function applyTheme(name) {
  document.body.classList.remove("light", "rose", "midnight", "cream");
  if (name === "light" || name === "cream") document.body.classList.add("light");
  if (name === "rose") {
    document.documentElement.style.setProperty("--bg", "#1a0510");
    document.documentElement.style.setProperty("--bg-2", "#2b0a1c");
  }
  if (name === "midnight") {
    document.documentElement.style.setProperty("--bg", "#02030a");
    document.documentElement.style.setProperty("--bg-2", "#0a0d1f");
  }
  if (name === "dark" || name === "rose" || name === "midnight") {
    document.documentElement.style.removeProperty("--bg");
    document.documentElement.style.removeProperty("--bg-2");
  }
}

// ══════════════════════════════════════════════════════════════
// MUSIC
// ══════════════════════════════════════════════════════════════
async function initMusic() {
  const audio = document.getElementById("bgMusic");
  const btn = document.getElementById("musicBtn");
  const player = document.getElementById("musicPlayer");
  const playIcon = btn.querySelector(".music-icon-play");
  const pauseIcon = btn.querySelector(".music-icon-pause");

  // default song title
  document.getElementById("musicTitle").textContent = state.songTitle || "Our song";

  // try to load custom song from indexedDB
  const blob = await dbGet("music:main");
  if (blob) {
    audio.src = URL.createObjectURL(blob);
  } else {
    // no custom song — leave silent (user can upload)
  }

  const tryPlay = () => {
    if (!audio.src) return;
    audio.play().then(() => {
      player.classList.add("playing");
      playIcon.classList.add("hidden");
      pauseIcon.classList.remove("hidden");
    }).catch(() => {});
  };
  document.addEventListener("click", tryPlay, { once: true });
  document.addEventListener("touchstart", tryPlay, { once: true });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!audio.src) { changeMusic(); return; }
    if (audio.paused) {
      audio.play().then(() => {
        player.classList.add("playing");
        playIcon.classList.add("hidden");
        pauseIcon.classList.remove("hidden");
      }).catch(() => {});
    } else {
      audio.pause();
      player.classList.remove("playing");
      playIcon.classList.remove("hidden");
      pauseIcon.classList.add("hidden");
    }
  });
}

// ══════════════════════════════════════════════════════════════
// COUNTER
// ══════════════════════════════════════════════════════════════
function initCounter() {
  function tick() {
    const now = new Date();
    const start = new Date(state.startDate || DEFAULTS.startDate);
    const diff = now - start;
    if (diff < 0) return;
    const totalSeconds = Math.floor(diff / 1000);
    document.getElementById("days").textContent = Math.floor(totalSeconds / 86400).toLocaleString();
    document.getElementById("hours").textContent = Math.floor((totalSeconds % 86400) / 3600);
    document.getElementById("minutes").textContent = Math.floor((totalSeconds % 3600) / 60);
    document.getElementById("seconds").textContent = totalSeconds % 60;
  }
  tick();
  setInterval(tick, 1000);
}

// ══════════════════════════════════════════════════════════════
// SURPRISE
// ══════════════════════════════════════════════════════════════
function initSurprise() {
  document.getElementById("heartBtn").addEventListener("click", () => {
    const textEl = document.getElementById("finalText");
    textEl.textContent = state.surprise || DEFAULTS.surprise;
    textEl.style.color = "var(--pink-soft)";
    const rain = document.getElementById("heartRain");
    const hearts = ["❤", "💕", "💖", "💗", "💘", "💝", "🌸", "✨"];
    for (let i = 0; i < 50; i++) {
      const h = document.createElement("div");
      h.className = "heart-drop";
      h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      h.style.left = Math.random() * 100 + "vw";
      h.style.fontSize = (18 + Math.random() * 24) + "px";
      h.style.animationDuration = (3 + Math.random() * 3) + "s";
      h.style.animationDelay = (Math.random() * 1.5) + "s";
      rain.appendChild(h);
      setTimeout(() => h.remove(), 8000);
    }
    document.getElementById("heartBtn").querySelector("span").textContent = "I love you ❤️";
  });
}

// ══════════════════════════════════════════════════════════════
// PETALS (ambient)
// ══════════════════════════════════════════════════════════════
function initPetals() {
  const wrap = document.getElementById("petals");
  const shapes = ["❤", "🌸", "✿", "❀", "♥", "✾"];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement("div");
    p.className = "petal";
    p.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    p.style.left = Math.random() * 100 + "vw";
    p.style.fontSize = (10 + Math.random() * 14) + "px";
    p.style.animationDuration = (12 + Math.random() * 14) + "s";
    p.style.animationDelay = (Math.random() * 20) + "s";
    wrap.appendChild(p);
  }
}

// ══════════════════════════════════════════════════════════════
// SCROLL ANIMATIONS
// ══════════════════════════════════════════════════════════════
function initScrollAnimations() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".moment").forEach(m => obs.observe(m));
}

// ══════════════════════════════════════════════════════════════
// LIGHTBOX
// ══════════════════════════════════════════════════════════════
function openLightbox(src) {
  const lb = document.getElementById("lightbox");
  lb.querySelector("img").src = src;
  lb.classList.add("open");
}

// ══════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = String(s == null ? "" : s);
  return d.innerHTML;
}

// ══════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  renderAll();

  // Wire editable text
  document.querySelectorAll(".editable").forEach(bindEditable);

  initMusic();
  initCounter();
  initSurprise();
  initPetals();
  initScrollAnimations();

  // Wire start button
  document.getElementById("startBtn").onclick = () => {
    document.querySelector(".timeline-section").scrollIntoView({ behavior: "smooth" });
  };

  // Wire editor toolbar
  document.getElementById("editToggle").onclick = () => {
    if (document.body.classList.contains("edit-mode")) closeEditor();
    else openEditor();
  };
  document.getElementById("etDone").onclick = closeEditor;
  document.getElementById("etAddMoment").onclick = addMoment;
  document.getElementById("etAddGallery").onclick = addGalleryPhoto;
  document.getElementById("etChangeMusic").onclick = changeMusic;
  document.getElementById("etChangeTheme").onclick = pickTheme;
  document.getElementById("etReset").onclick = () => {
    if (!confirm("Reset everything to the default story? This deletes all your edits and photos.")) return;
    localStorage.removeItem("ourstory-state");
    // clear files
    if (idb) {
      const tx = idb.transaction("files", "readwrite");
      tx.objectStore("files").clear();
    }
    state = JSON.parse(JSON.stringify(DEFAULTS));
    saveState();
    renderAll();
    toast("Reset ✓");
  };

  // Lightbox close
  document.getElementById("lightbox").onclick = () => {
    document.getElementById("lightbox").classList.remove("open");
  };

  // Escape closes editor
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.getElementById("lightbox").classList.remove("open");
      if (document.body.classList.contains("edit-mode")) closeEditor();
    }
  });

  // Hide loader
  setTimeout(() => document.getElementById("loader").classList.add("hidden"), 1200);
});