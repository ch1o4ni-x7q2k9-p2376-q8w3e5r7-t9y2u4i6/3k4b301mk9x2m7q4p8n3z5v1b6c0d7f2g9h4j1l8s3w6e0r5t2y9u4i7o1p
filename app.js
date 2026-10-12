// ═══════════════════════════════════════════════════════════
//  Our Story — reader + in-page editor
//  Reads story.json from GitHub, renders it, and (if the token
//  is configured) lets you edit and commit changes back.
// ═══════════════════════════════════════════════════════════

const API = "https://api.github.com";
const RAW = (owner, repo, branch) =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;

let story = null;        // the loaded story object
let isEditor = false;    // true if ?edit= matches CONFIG.editKey (or key empty)
let pendingImages = [];  // { name, base64, dataUrl } waiting to be committed

// ─── Toast ───
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.classList.add("hidden"), 300);
  }, 2400);
}

// ─── Save pill ───
function setSavePill(text, cls = "") {
  const p = document.getElementById("savePill");
  p.textContent = text;
  p.className = "save-pill " + cls;
  p.classList.remove("hidden");
}

// ═══════════════════════════════════════════════════════════
// LOAD
// ═══════════════════════════════════════════════════════════
async function loadStory() {
  try {
    const url = RAW(CONFIG.owner, CONFIG.repo, CONFIG.branch) + "/" + CONFIG.storyPath + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    story = await res.json();
  } catch (e) {
    console.error("Failed to load story.json", e);
    toast("Could not load story.json");
    story = {};
  }
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderAll() {
  // Simple text fields
  document.querySelectorAll("[data-key]").forEach(el => {
    const key = el.dataset.key;
    if (key === "letterBody") return;
    if (story[key] !== undefined) el.textContent = story[key];
  });

  // Letter body paragraphs
  const body = document.getElementById("letterBody");
  body.innerHTML = "";
  (story.letterBody || []).forEach((p, i) => {
    const el = document.createElement("p");
    el.className = "editable";
    el.dataset.key = `letterBody.${i}`;
    el.textContent = p;
    bindEditable(el);
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
        <div class="image-picker" data-act="pick-moment" data-i="${i}">📷 Change photo</div>
        ${m.photo ? `<img class="moment-img" src="${m.photo}" alt="">` : `<div class="moment-img" style="display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;">📷 No photo yet</div>`}
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
      <div class="image-picker" data-act="pick-gallery" data-i="${i}">📷 Change</div>
      <img src="${src}" alt="">
    `;
    el.querySelector("img").onclick = (e) => {
      if (document.body.classList.contains("edit-mode")) return;
      openLightbox(src);
    };
    g.appendChild(el);
  });

  // bind editables
  document.querySelectorAll(".editable").forEach(bindEditable);

  // Music player title
  document.getElementById("musicTitle").textContent = story.songTitle || "Our song";
  document.getElementById("bgMusic").src = story.songFile || "";

  // show/hide music player
  document.getElementById("musicPlayer").classList.toggle("hidden", !story.songFile);

  // show/hide editor controls
  if (isEditor) {
    document.getElementById("editToggle").classList.remove("hidden");
    document.getElementById("savePill").classList.remove("hidden");
    setSavePill("Ready");
  }

  // scroll animations
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

  // Make sure it's focusable
  el.setAttribute("tabindex", "0");

  // pointerdown works better than click on touch + desktop
  el.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;
    e.stopPropagation();
    e.preventDefault();
    el.setAttribute("contenteditable", "true");
    el.focus();
    // put the cursor at the end
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
    console.log("saved", key, "=", value);
  });

  el.addEventListener("keydown", (e) => {
    // Enter saves (unless it's a letter paragraph where Enter adds a line break)
    if (e.key === "Enter" && !e.shiftKey && !el.dataset.key?.includes("letterBody")) {
      e.preventDefault();
      el.blur();
    }
    // Escape cancels
    if (e.key === "Escape") {
      el.blur();
    }
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
// IMAGE HANDLING
// ═══════════════════════════════════════════════════════════
function pickImage(cb) {
  const input = document.getElementById("imgInput");
  input.value = "";
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

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════
// EDIT ACTIONS
// ═══════════════════════════════════════════════════════════
function addMoment() {
  if (!story.moments) story.moments = [];
  story.moments.push({ date: "Month Year", title: "New moment", text: "Write your story here...", photo: "" });
  renderAll();
  toast("Moment added — edit it and click Save");
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
      // store in memory until Save is pressed
      story.gallery.push("__PENDING__" + name);
      pendingImages.push({ name, base64, path: CONFIG.photosPath + name });
    }
    // now we need to render with pending placeholders — but we don't have raw URLs
    // simplest: keep a pendingMap of name → dataUrl for local preview
    for (const p of pendingImages) {
      const i = story.gallery.indexOf("__PENDING__" + p.name);
      if (i >= 0) story.gallery[i] = p.path + "?pending=" + encodeURIComponent(p.name);
    }
    renderGalleryWithPending();
    toast(files.length + " photo(s) ready — click Save");
  };
  input.click();
}

function renderGalleryWithPending() {
  const g = document.getElementById("gallery");
  g.innerHTML = "";
  (story.gallery || []).forEach((src, i) => {
    let imgSrc = src;
    // if src is a pending path, look up the local dataURL
    if (src.includes("?pending=")) {
      const name = decodeURIComponent(src.split("?pending=")[1]);
      const found = pendingImages.find(p => p.name === name);
      if (found) imgSrc = found.dataUrl;
    }
    const el = document.createElement("div");
    el.className = "gallery-item";
    el.innerHTML = `
      <button class="gallery-remove" data-act="rm-photo" data-i="${i}">✕</button>
      <div class="image-picker" data-act="pick-gallery" data-i="${i}">📷 Change</div>
      <img src="${imgSrc}" alt="">
    `;
    g.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════
// SAVE (commit to GitHub)
// ═══════════════════════════════════════════════════════════
async function saveToGitHub() {
  if (!CONFIG.token || CONFIG.token.includes("REPLACE")) {
    toast("No token set in config.js");
    return;
  }
  setSavePill("Saving…", "saving");

  try {
    // 1. Upload any pending images
    for (const img of pendingImages) {
      await putFile(img.path, img.base64, "Add " + img.name);
    }
    // 2. Clean up __PENDING__ / ?pending= markers in gallery
    story.gallery = (story.gallery || []).map(src => {
      if (src.includes("?pending=")) return src.split("?pending=")[0];
      if (src.startsWith("__PENDING__")) return CONFIG.photosPath + src.slice("__PENDING__".length);
      return src;
    });
    pendingImages = [];

    // 3. Commit story.json
    const json = JSON.stringify(story, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    await putFile(CONFIG.storyPath, base64, "Update story");

    setSavePill("Saved ✓", "saved");
    toast("Saved! GitHub Pages will update in ~30s");
  } catch (e) {
    console.error(e);
    setSavePill("Error: " + e.message, "error");
    toast("Save failed: " + e.message);
  }
}

// ─── GitHub Contents API: create or update a file ───
async function putFile(path, base64Content, message) {
  const url = `${API}/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
  const headers = {
    "Authorization": `Bearer ${CONFIG.token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };

  // get existing sha if the file exists
  let sha = null;
  try {
    const r = await fetch(url, { headers });
    if (r.ok) {
      const data = await r.json();
      sha = data.sha;
    }
  } catch {}

  const body = {
    message,
    content: base64Content,
    branch: CONFIG.branch
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });

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
    // store in memory; commit on save
    pendingImages.push({ name, base64, path, isMusic: true });
    story.songFile = path + "?pending=" + encodeURIComponent(name);
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
// EDITOR MODE
// ═══════════════════════════════════════════════════════════
function checkEditorAccess() {
  const params = new URLSearchParams(location.search);
  const k = params.get("edit");
  if (!CONFIG.editKey) {
    // no key set → editor toggle is always visible if a token exists
    isEditor = !!CONFIG.token && !CONFIG.token.includes("REPLACE");
  } else {
    isEditor = k === CONFIG.editKey;
  }
}

function openEditor() {
  document.body.classList.add("edit-mode");
  document.getElementById("editToolbar").classList.add("open");
  toast("Edit mode — click text to change, then Save");
}

function closeEditor() {
  document.body.classList.remove("edit-mode");
  document.getElementById("editToolbar").classList.remove("open");
  saveToGitHub();
}

// ═══════════════════════════════════════════════════════════
// MISC (music player, counter, surprise, petals, scroll, lightbox)
// ═══════════════════════════════════════════════════════════
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
    document.querySelector("#heartBtn span").textContent = "I love you ❤️";
  });
}

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
// BOOT
// ═══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  checkEditorAccess();
  await loadStory();
  renderAll();
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

  document.getElementById("etDone").onclick = closeEditor;
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

  // event delegation for remove buttons + image pickers
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t.dataset || !t.dataset.act) return;
    const i = parseInt(t.dataset.i);

    if (t.dataset.act === "rm-moment") {
      e.stopPropagation();
      if (!confirm("Remove this moment?")) return;
      story.moments.splice(i, 1);
      renderAll();
    }
    if (t.dataset.act === "rm-photo") {
      e.stopPropagation();
      story.gallery.splice(i, 1);
      renderGalleryWithPending();
    }
    if (t.dataset.act === "pick-moment") {
      e.stopPropagation();
      pickImage(({ name, base64, dataUrl }) => {
        const path = CONFIG.photosPath + name;
        pendingImages.push({ name, base64, path });
        story.moments[i].photo = dataUrl; // preview
        // remember real path for save
        story.moments[i].__pendingPhoto = path;
        renderAll();
        toast("Photo ready — click Save");
      });
    }
    if (t.dataset.act === "pick-gallery") {
      e.stopPropagation();
      pickImage(({ name, base64, dataUrl }) => {
        const path = CONFIG.photosPath + name;
        pendingImages.push({ name, base64, path });
        story.gallery[i] = dataUrl;
        story.gallery[i + "_path"] = path;
        renderGalleryWithPending();
        toast("Photo ready — click Save");
      });
    }
  });

  // hide loader
  setTimeout(() => document.getElementById("loader").classList.add("hidden"), 1000);
});

// Before saving, convert any dataUrl previews back to repo paths
const _origSave = saveToGitHub;
saveToGitHub = async function () {
  // fix moment photos
  (story.moments || []).forEach(m => {
    if (m.__pendingPhoto) { m.photo = m.__pendingPhoto; delete m.__pendingPhoto; }
  });
  // fix gallery
  if (story.gallery) {
    story.gallery = story.gallery.map((src, i) => {
      const p = story["gallery_" + i + "_path"];
      return p || src;
    });
    Object.keys(story).filter(k => k.startsWith("gallery_")).forEach(k => delete story[k]);
  }
  return _origSave.apply(this, arguments);
};