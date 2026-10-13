// ═══════════════════════════════════════════════════════════
//  Our Story — reader + in-page editor
//  Token is entered once per session, kept in sessionStorage,
//  never stored in the repo.
// ═══════════════════════════════════════════════════════════
window.MILESTONES = window.MILESTONES || [];
const API = "https://api.github.com";
const RAW = (owner, repo, branch) =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;

let story = null;
let isEditor = false;
let pendingImages = [];

// ─── Fallback content (used if story.json fails) ───
const FALLBACK = {
  heroSub: "A story written in moments",
  heroTitle: "Our Story",
  yourName: "Your Name",
  herName: "Her Name",
  startDate: "2023-01-01T00:00:00",
  startDateLabel: "Since January 1, 2023",
  quote: "\"In a world of temporary things, you are my forever.\"",
  timelineTitle: "Our Journey Together",
  timelineSub: "Every moment, every laugh, every tear",
  parallaxText: "You & Me",
  galleryTitle: "Moments We've Captured",
  letterGreeting: "My dearest,",
  letterBody: [
    "From the moment I met you, something in me knew.",
    "Every day with you is a gift.",
    "Thank you for choosing me.",
    "I love you more than words can say."
  ],
  letterSignature: "Forever yours",
  counterLabel: "We've been together for",
  finalTitle: "And this is just the beginning",
  finalText: "Every day with you is a gift. Here's to a thousand more memories.",
  surprise: "You are my favorite person. I love you. ❤️",
  songTitle: "Our song",
  songFile: "",
  moments: [
    { date: "January 2023", title: "The day we met", text: "I still remember thinking — this is different.", photo: "" }
  ],
  gallery: []
};

// ─── Toast ───
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) { console.log(msg); return; }
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.classList.add("hidden"), 300);
  }, 2600);
}

// ─── Save pill ───
function setSavePill(text, cls = "") {
  const p = document.getElementById("savePill");
  if (!p) return;
  p.textContent = text;
  p.className = "save-pill " + cls;
  p.classList.remove("hidden");
}

// ═══════════════════════════════════════════════════════════
// EDITOR ACCESS — ask for token once per session
// ═══════════════════════════════════════════════════════════
function checkEditorAccess() {
  const params = new URLSearchParams(location.search);
  if (!params.has("edit")) { isEditor = false; return; }

  if (CONFIG.editKey && params.get("edit") !== CONFIG.editKey) {
    isEditor = false;
    return;
  }

  let token = sessionStorage.getItem("gh_token") || "";
  if (!token) {
    token = (prompt(
      "Paste your GitHub token (stays in this browser only, cleared when tab closes):"
    ) || "").trim();
    if (token) sessionStorage.setItem("gh_token", token);
  }
  if (!token) { isEditor = false; return; }

  CONFIG.token = token;
  isEditor = true;
}

// ═══════════════════════════════════════════════════════════
// LOAD STORY
// ═══════════════════════════════════════════════════════════
async function loadStory() {
  try {
    const url = RAW(CONFIG.owner, CONFIG.repo, CONFIG.branch) + "/" + CONFIG.storyPath + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    story = await res.json();
    story = { ...FALLBACK, ...story };
  } catch (e) {
    console.error("story.json failed, using fallback:", e);
    story = JSON.parse(JSON.stringify(FALLBACK));
    setTimeout(() => toast("Using fallback content — check story.json"), 700);
  }
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderAll() {
  // Simple top-level text fields
  document.querySelectorAll("[data-key]").forEach(el => {
    const key = el.dataset.key;
    if (!key || key === "letterBody") return;
    if (key.startsWith("moments.") || key.startsWith("letterBody.")) return;
    if (story[key] !== undefined && story[key] !== null) {
      el.textContent = story[key];
    }
  });

  // Letter body
  const body = document.getElementById("letterBody");
  body.innerHTML = "";
  (story.letterBody || []).forEach((p, i) => {
    const el = document.createElement("p");
    el.className = "editable";
    el.dataset.key = `letterBody.${i}`;
    el.textContent = p;
    body.appendChild(el);
  });

  // Timeline
  const tl = document.getElementById("timeline");
  tl.innerHTML = "";
  (story.moments || []).forEach((m, i) => {
    const el = document.createElement("div");
    el.className = "moment";
    el.dataset.index = i;
    el.innerHTML = `
      <div class="moment-card">
        <button class="moment-remove" data-act="rm-moment" data-i="${i}">✕</button>
        <div class="moment-photo-wrap">
          <div class="image-picker" data-act="pick-moment" data-i="${i}">📷 Click to change photo</div>
          ${(m.__preview || m.photo)
            ? `<img class="moment-img" data-act="view-moment" data-i="${i}" src="${m.__preview || m.photo}" alt="" style="cursor:zoom-in;">`
            : `<div class="moment-img" style="display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;">📷 No photo yet</div>`}
        </div>
        <span class="moment-date editable" data-key="moments.${i}.date">${esc(m.date)}</span>
        <h3 class="moment-title editable" data-key="moments.${i}.title">${esc(m.title)}</h3>
        <p class="moment-text editable" data-key="moments.${i}.text">${esc(m.text)}</p>
      </div>
      <div class="moment-dot"></div>
    `;
    tl.appendChild(el);
  });

  // Gallery
  const g = document.getElementById("gallery");
  g.innerHTML = "";
  (story.gallery || []).forEach((src, i) => {
    const el = document.createElement("div");
    el.className = "gallery-item";
    el.innerHTML = `
      <button class="gallery-remove" data-act="rm-photo" data-i="${i}">✕</button>
      <div class="moment-photo-wrap" style="width:100%;height:100%;">
        <div class="image-picker" data-act="pick-gallery" data-i="${i}">📷 Click to change</div>
        <img src="${story["__galleryPreview_" + i] || src}" alt="" data-act="view-gallery" data-i="${i}" style="width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in;">
      </div>
    `;
    g.appendChild(el);
  });

  // Bind every editable element
  document.querySelectorAll(".editable").forEach(bindEditable);

  // Music player
  const mt = document.getElementById("musicTitle");
  if (mt) mt.textContent = story.songTitle || "Our song";
  const bg = document.getElementById("bgMusic");
  if (bg) bg.src = story.songFile || "";
  const mp = document.getElementById("musicPlayer");
  if (mp) mp.classList.toggle("hidden", !story.songFile);

  // Editor UI
  if (isEditor) {
    document.getElementById("editToggle").classList.remove("hidden");
    document.getElementById("savePill").classList.remove("hidden");
    setSavePill("Ready");
  }

  initScrollAnims();
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : s;
  return d.innerHTML;
}

// ═══════════════════════════════════════════════════════════
// EDITABLE TEXT
// ═══════════════════════════════════════════════════════════
function bindEditable(el) {
  if (el.dataset.bound) return;
  el.dataset.bound = "1";
  el.setAttribute("tabindex", "0");

  el.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;
    if (e.target.closest(".image-picker")) return;
    e.stopPropagation();
    el.setAttribute("contenteditable", "true");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  el.addEventListener("blur", () => {
    if (!document.body.classList.contains("edit-mode")) return;
    el.removeAttribute("contenteditable");
    const key = el.dataset.key;
    if (!key) return;
    const value = el.textContent.trim();
    setByPath(story, key, value);
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !(el.dataset.key || "").includes("letterBody")) {
      e.preventDefault();
      el.blur();
    }
    if (e.key === "Escape") el.blur();
  });
}

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

// ═══════════════════════════════════════════════════════════
// IMAGE HELPERS
// ═══════════════════════════════════════════════════════════
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function pickImage(cb) {
  const input = document.getElementById("imgInput");
  input.value = "";
  input.multiple = false;
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const dataUrl = await fileToDataURL(file);
    const base64 = dataUrl.split(",")[1];
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const name = "photo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "." + ext;
    cb({ name, base64, dataUrl });
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════
// ADD / REMOVE
// ═══════════════════════════════════════════════════════════
function addMoment() {
  if (!story.moments) story.moments = [];
  story.moments.push({ date: "Month Year", title: "New moment", text: "Write your story here...", photo: "" });
  renderAll();
  toast("Moment added — edit it, add a photo, then click Save");
}

function addPhotosFromInput() {
  const input = document.getElementById("imgInput");
  input.value = "";
  input.multiple = true;
  input.onchange = async () => {
    const files = [...input.files];
    if (!files.length) return;
    if (!story.gallery) story.gallery = [];

    for (const file of files) {
      const dataUrl = await fileToDataURL(file);
      const base64 = dataUrl.split(",")[1];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const name = "photo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "." + ext;
      const path = CONFIG.photosPath + name;

      story.gallery.push(path);
      const idx = story.gallery.length - 1;
      story["__galleryPreview_" + idx] = dataUrl;
      pendingImages.push({ name, base64, path });
    }

    renderAll();
    toast(files.length + " photo(s) ready — click Save");
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════
async function saveToGitHub() {
  const token = sessionStorage.getItem("gh_token") || CONFIG.token || "";
  if (!token) { toast("No token — reload the ?edit= page"); return; }
  CONFIG.token = token;

  setSavePill("Saving…", "saving");

  try {
    // 1. Upload every pending image (photos and songs)
    for (const img of pendingImages) {
      await putFile(img.path, img.base64, "Add " + img.name);
    }

    // 2. Fix moment photo fields
    (story.moments || []).forEach(m => {
      if (m.__pendingPhoto) {
        m.photo = m.__pendingPhoto;
        delete m.__pendingPhoto;
      }
      if (typeof m.photo === "string" && m.photo.startsWith("data:")) {
        m.photo = "";
      }
      delete m.__preview;
    });

    // 3. Fix gallery entries
    if (Array.isArray(story.gallery)) {
      story.gallery = story.gallery.filter(src => !(typeof src === "string" && src.startsWith("data:")));
    }

    // 4. Clear previews
    Object.keys(story).filter(k => k.startsWith("__galleryPreview_")).forEach(k => delete story[k]);
    pendingImages = [];

    // 5. Commit story.json
    const json = JSON.stringify(story, null, 2);
    if (json.length > 5_000_000) {
      throw new Error("story.json too large — too many embedded images");
    }
    const base64 = btoa(unescape(encodeURIComponent(json)));
    await putFile(CONFIG.storyPath, base64, "Update story");

    setSavePill("Saved ✓", "saved");
    toast("Saved! GitHub Pages updates in ~30s");
  } catch (e) {
    console.error(e);
    setSavePill("Error: " + e.message, "error");
    toast("Save failed: " + e.message);
  }
}

async function putFile(path, base64Content, message) {
  const url = `${API}/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
  const headers = {
    "Authorization": `Bearer ${CONFIG.token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };

  let sha = null;
  try {
    const r = await fetch(url, { headers });
    if (r.ok) { const d = await r.json(); sha = d.sha; }
  } catch {}

  const body = { message, content: base64Content, branch: CONFIG.branch };
  if (sha) body.sha = sha;

  const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || ("HTTP " + res.status));
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════
// MUSIC
// ═══════════════════════════════════════════════════════════
function changeMusic() {
  const input = document.getElementById("musicInput");
  input.value = "";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast("Please pick an audio file under 25 MB");
      return;
    }
    const dataUrl = await fileToDataURL(file);
    const base64 = dataUrl.split(",")[1];
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
    const name = "song-" + Date.now() + "." + ext;
    const path = CONFIG.musicPath + name;
    pendingImages.push({ name, base64, path });
    story.songFile = path;
    story.songTitle = file.name.replace(/\.[^.]+$/, "");
    document.getElementById("musicTitle").textContent = story.songTitle;
    const audio = document.getElementById("bgMusic");
    audio.src = dataUrl;
    document.getElementById("musicPlayer").classList.remove("hidden");
    toast("Music ready — click Save");
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════
// UI EXTRAS
// ═══════════════════════════════════════════════════════════
function openEditor() {
  document.body.classList.add("edit-mode");
  document.getElementById("editToolbar").classList.add("open");
  toast("Edit mode — click text to change, then Save");
}

function closeEditor() {
  document.body.classList.remove("edit-mode");
  document.getElementById("editToolbar").classList.remove("open");
}

function initMusicPlayer() {
  const audio = document.getElementById("bgMusic");
  const btn = document.getElementById("musicBtn");
  const player = document.getElementById("musicPlayer");
  const playIcon = btn.querySelector(".music-icon-play");
  const pauseIcon = btn.querySelector(".music-icon-pause");

  const tryPlay = () => {
    if (!audio.src) return;
    audio.play().then(() => {
      player.classList.add("playing");
      playIcon.classList.add("hidden");
      pauseIcon.classList.remove("hidden");
    }).catch(() => {});
  };
  document.addEventListener("click", tryPlay, { once: true });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!audio.src) return;
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

function initCounter() {
  function tick() {
    const start = new Date(story.startDate || "2023-01-01T00:00:00");
    const diff = Date.now() - start.getTime();
    if (diff < 0) return;
    const s = Math.floor(diff / 1000);
    document.getElementById("days").textContent = Math.floor(s / 86400).toLocaleString();
    document.getElementById("hours").textContent = Math.floor((s % 86400) / 3600);
    document.getElementById("minutes").textContent = Math.floor((s % 3600) / 60);
    document.getElementById("seconds").textContent = s % 60;
  }
  tick();
  setInterval(tick, 1000);
}

function initSurprise() {
  document.getElementById("heartBtn").addEventListener("click", () => {
    const t = document.getElementById("finalText");
    t.textContent = story.surprise || "I love you ❤️";
    t.style.color = "var(--pink-soft)";
    const rain = document.getElementById("heartRain");
    const hearts = ["❤","💕","💖","💗","💘","💝","🌸","✨"];
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
    document.querySelector("#heartBtn span").textContent = "I love you ❤️";
  });
}

function initPetals() {
  const wrap = document.getElementById("petals");
  const shapes = ["❤","🌸","✿","❀","♥","✾"];
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

function initScrollAnims() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".moment").forEach(m => obs.observe(m));
}

function openLightbox(src) {
  const lb = document.getElementById("lightbox");
  lb.querySelector("img").src = src;
  lb.classList.add("open");
}

// ═══════════════════════════════════════════════════════════
// MILESTONE COUNTDOWNS
// ═══════════════════════════════════════════════════════════
// Edit this array to change what shows on the page.
// Date format: "YYYY-MM-DD". repeatYearly: true rolls it forward each year.
const MILESTONES = [
  {
    emoji: "💕",
    title: "Our anniversary",
    date: "2026-06-19",
    repeatYearly: true
  },
  {
    emoji: "🎂",
    title: "Her birthday",
    date: "2026-08-15",
    repeatYearly: true
  },
  {
    emoji: "🎉",
    title: "My birthday",
    date: "2026-03-04",
    repeatYearly: true
  }
];

function nextOccurrence(dateStr, repeatYearly) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("-").map(Number);
  let target = new Date(y, m - 1, d);
  if (repeatYearly) {
    while (target < today) target.setFullYear(target.getFullYear() + 1);
  }
  return target;
}

function daysUntil(target) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function renderMilestones() {
  const wrap = document.getElementById("milestones");
  if (!wrap) return;
  wrap.innerHTML = "";

  MILESTONES.forEach(m => {
    const target = nextOccurrence(m.date, m.repeatYearly);
    const diff = daysUntil(target);

    let num, unit, cls = "";
    if (diff === 0) {
      num = "Today";
      unit = "🎉 celebrate!";
      cls = "milestone-today";
    } else if (diff < 0) {
      num = Math.abs(diff);
      unit = "days ago";
      cls = "milestone-past";
    } else {
      num = diff;
      unit = diff === 1 ? "day to go" : "days to go";
    }

    const el = document.createElement("div");
    el.className = "milestone-card " + cls;
    el.innerHTML = `
      <span class="milestone-emoji">${m.emoji}</span>
      <p class="milestone-title">${m.title}</p>
      <p class="milestone-date">${target.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      <p class="milestone-num">${num}</p>
      <span class="milestone-unit">${unit}</span>
    `;
    wrap.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  checkEditorAccess();
  await loadStory();
  renderAll();
  renderMilestones();
  initMusicPlayer();
  initCounter();
  initSurprise();
  initPetals();

  document.getElementById("startBtn").onclick = () =>
    document.querySelector(".timeline-section").scrollIntoView({ behavior: "smooth" });

  document.getElementById("editToggle").onclick = () => {
    if (document.body.classList.contains("edit-mode")) closeEditor();
    else openEditor();
  };

  document.getElementById("etDone").onclick = async () => {
    await saveToGitHub();
    closeEditor();
  };
  document.getElementById("etAddMoment").onclick = addMoment;
  document.getElementById("etAddPhoto").onclick = addPhotosFromInput;
  document.getElementById("etChangeMusic").onclick = changeMusic;

  document.getElementById("lightbox").onclick = () =>
    document.getElementById("lightbox").classList.remove("open");

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.getElementById("lightbox").classList.remove("open");
      if (document.body.classList.contains("edit-mode")) closeEditor();
    }
  });

  // Delegated clicks for remove buttons + image pickers + view
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t.dataset || !t.dataset.act) return;
    const i = parseInt(t.dataset.i);

    if (t.dataset.act === "view-moment") {
      e.stopPropagation();
      const src = story.moments[i]?.__preview || story.moments[i]?.photo;
      if (src) openLightbox(src);
      return;
    }
    if (t.dataset.act === "view-gallery") {
      e.stopPropagation();
      const src = story["__galleryPreview_" + i] || story.gallery[i];
      if (src) openLightbox(src);
      return;
    }
    if (t.dataset.act === "rm-moment") {
      e.stopPropagation();
      if (!confirm("Remove this moment?")) return;
      story.moments.splice(i, 1);
      renderAll();
    }
    if (t.dataset.act === "rm-photo") {
      e.stopPropagation();
      story.gallery.splice(i, 1);
      renderAll();
    }
    if (t.dataset.act === "pick-moment") {
      e.stopPropagation();
      pickImage(({ name, base64, dataUrl }) => {
        const path = CONFIG.photosPath + name;
        pendingImages.push({ name, base64, path });
        story.moments[i].__preview = dataUrl;
        story.moments[i].__pendingPhoto = path;
        story.moments[i].photo = path;
        renderAll();
        toast("Photo ready — click Save");
      });
    }
    if (t.dataset.act === "pick-gallery") {
      e.stopPropagation();
      pickImage(({ name, base64, dataUrl }) => {
        const path = CONFIG.photosPath + name;
        pendingImages.push({ name, base64, path });
        story.gallery[i] = path;
        story["__galleryPreview_" + i] = dataUrl;
        renderAll();
        toast("Photo ready — click Save");
      });
    }
  });

  // Block right-click save on images only
  document.addEventListener("contextmenu", (e) => {
    if (e.target.tagName === "IMG") e.preventDefault();
  });

  // Hide loader
  setTimeout(() => document.getElementById("loader").classList.add("hidden"), 900);

  // Refresh milestones hourly
  setInterval(renderMilestones, 3600 * 1000);
});
