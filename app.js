// ═══════════════════════════════════════════════════════════
//  Our Story
// ═══════════════════════════════════════════════════════════

const API = "https://api.github.com";
const RAW = (owner, repo, branch) =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;

let story = null;
let isEditor = false;
let pendingImages = [];

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
  surprise: "You are my favorite person. I love you.",
  songTitle: "Our song",
  songFile: "",
  moments: [
    { date: "January 2023", title: "The day we met", text: "I still remember thinking: this is different.", photo: "" }
  ],
  gallery: []
};

setTimeout(function () {
  var l = document.getElementById("loader");
  if (l) l.classList.add("hidden");
}, 1200);

var toastTimer;
function toast(msg) {
  var t = document.getElementById("toast");
  if (!t) { console.log(msg); return; }
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    t.classList.remove("show");
    setTimeout(function () { t.classList.add("hidden"); }, 300);
  }, 2600);
}

function setSavePill(text, cls) {
  var p = document.getElementById("savePill");
  if (!p) return;
  p.textContent = text;
  p.className = "save-pill " + (cls || "");
  p.classList.remove("hidden");
}

function esc(s) {
  var d = document.createElement("div");
  d.textContent = s == null ? "" : s;
  return d.innerHTML;
}

// ═══════════════════════════════════════════════════════════
// EDITOR ACCESS
// ═══════════════════════════════════════════════════════════
function checkEditorAccess() {
  var params = new URLSearchParams(location.search);
  if (!params.has("edit")) { isEditor = false; return; }
  if (CONFIG.editKey && params.get("edit") !== CONFIG.editKey) { isEditor = false; return; }

  var token = sessionStorage.getItem("gh_token") || "";
  if (!token) {
    token = (prompt("Paste your GitHub token (stays in this browser only):") || "").trim();
    if (token) sessionStorage.setItem("gh_token", token);
  }
  if (!token) { isEditor = false; return; }

  CONFIG.token = token;
  isEditor = true;
}

// ═══════════════════════════════════════════════════════════
// LOAD STORY
// ═══════════════════════════════════════════════════════════
function loadStory() {
  var url = RAW(CONFIG.owner, CONFIG.repo, CONFIG.branch) + "/" + CONFIG.storyPath + "?t=" + Date.now();
  return fetch(url, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      story = Object.assign({}, FALLBACK, data);
    })
    .catch(function (e) {
      console.error("story.json failed:", e);
      story = JSON.parse(JSON.stringify(FALLBACK));
      setTimeout(function () { toast("Using fallback content"); }, 700);
    });
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderAll() {
  document.querySelectorAll("[data-key]").forEach(function (el) {
    var key = el.dataset.key;
    if (!key || key === "letterBody") return;
    if (key.indexOf("moments.") === 0) return;
    if (key.indexOf("letterBody.") === 0) return;
    if (story[key] !== undefined && story[key] !== null) {
      el.textContent = story[key];
    }
  });

  var body = document.getElementById("letterBody");
  if (body) {
    body.innerHTML = "";
    (story.letterBody || []).forEach(function (p, i) {
      var el = document.createElement("p");
      el.className = "editable";
      el.dataset.key = "letterBody." + i;
      el.textContent = p;
      body.appendChild(el);
    });
  }

  var tl = document.getElementById("timeline");
  if (tl) {
    tl.innerHTML = "";
    (story.moments || []).forEach(function (m, i) {
      var el = document.createElement("div");
      el.className = "moment";
      el.dataset.index = i;
      var imgHTML;
      if (m.__preview || m.photo) {
        imgHTML = '<img class="moment-img" data-act="view-moment" data-i="' + i + '" src="' + (m.__preview || m.photo) + '" alt="" style="cursor:zoom-in;">';
      } else {
        imgHTML = '<div class="moment-img" style="display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;">No photo yet</div>';
      }
      el.innerHTML =
        '<div class="moment-card">' +
          '<button class="moment-remove" data-act="rm-moment" data-i="' + i + '">✕</button>' +
          '<div class="moment-photo-wrap">' +
            '<div class="image-picker" data-act="pick-moment" data-i="' + i + '">Click to change photo</div>' +
            imgHTML +
          '</div>' +
          '<div class="moment-body">' +
            '<span class="moment-date editable" data-key="moments.' + i + '.date">' + esc(m.date) + '</span>' +
            '<h3 class="moment-title editable" data-key="moments.' + i + '.title">' + esc(m.title) + '</h3>' +
            '<p class="moment-text editable" data-key="moments.' + i + '.text">' + esc(m.text) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="moment-dot"></div>';
      tl.appendChild(el);
    });
  }

  var g = document.getElementById("gallery");
  if (g) {
    g.innerHTML = "";
    (story.gallery || []).forEach(function (src, i) {
      var el = document.createElement("div");
      el.className = "gallery-item";
      el.innerHTML =
        '<button class="gallery-remove" data-act="rm-photo" data-i="' + i + '">✕</button>' +
        '<div class="moment-photo-wrap" style="width:100%;height:100%;">' +
          '<div class="image-picker" data-act="pick-gallery" data-i="' + i + '">Click to change</div>' +
          '<img src="' + (story["__galleryPreview_" + i] || src) + '" alt="" data-act="view-gallery" data-i="' + i + '" style="width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in;">' +
        '</div>';
      g.appendChild(el);
    });
  }

  document.querySelectorAll(".editable").forEach(bindEditable);

  var mt = document.getElementById("musicTitle");
  if (mt) mt.textContent = story.songTitle || "Our song";
  var bg = document.getElementById("bgMusic");
  if (bg) bg.src = story.songFile || "";
  var mp = document.getElementById("musicPlayer");
  if (mp) mp.classList.toggle("hidden", !story.songFile);

  if (isEditor) {
    var et = document.getElementById("editToggle");
    var sp = document.getElementById("savePill");
    if (et) et.classList.remove("hidden");
    if (sp) sp.classList.remove("hidden");
    setSavePill("Ready");
  }

  initScrollAnims();
}

// ═══════════════════════════════════════════════════════════
// EDITABLE
// ═══════════════════════════════════════════════════════════
function bindEditable(el) {
  if (el.dataset.bound) return;
  el.dataset.bound = "1";
  el.setAttribute("tabindex", "0");

  el.addEventListener("pointerdown", function (e) {
    if (!document.body.classList.contains("edit-mode")) return;
    if (e.target.closest(".image-picker")) return;
    e.stopPropagation();
    el.setAttribute("contenteditable", "true");
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  el.addEventListener("blur", function () {
    if (!document.body.classList.contains("edit-mode")) return;
    el.removeAttribute("contenteditable");
    var key = el.dataset.key;
    if (!key) return;
    var value = el.textContent.trim();
    setByPath(story, key, value);
  });

  el.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && (el.dataset.key || "").indexOf("letterBody") === -1) {
      e.preventDefault();
      el.blur();
    }
    if (e.key === "Escape") el.blur();
  });
}

function setByPath(obj, path, value) {
  var parts = path.split(".");
  var cur = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    var p = parts[i];
    if (cur[p] === undefined) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

// ═══════════════════════════════════════════════════════════
// IMAGE HELPERS
// ═══════════════════════════════════════════════════════════
function fileToDataURL(file) {
  return new Promise(function (res, rej) {
    var r = new FileReader();
    r.onload = function () { res(r.result); };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function pickImage(cb) {
  var input = document.getElementById("imgInput");
  input.value = "";
  input.multiple = false;
  input.onchange = function () {
    var file = input.files[0];
    if (!file) return;
    fileToDataURL(file).then(function (dataUrl) {
      var base64 = dataUrl.split(",")[1];
      var ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      var name = "photo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "." + ext;
      cb({ name: name, base64: base64, dataUrl: dataUrl });
    });
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════
// ADD
// ═══════════════════════════════════════════════════════════
function addMoment() {
  if (!story.moments) story.moments = [];
  story.moments.push({ date: "Month Year", title: "New moment", text: "Write your story here...", photo: "" });
  renderAll();
  toast("Moment added");
}

function addPhotosFromInput() {
  var input = document.getElementById("imgInput");
  input.value = "";
  input.multiple = true;
  input.onchange = function () {
    var files = Array.from(input.files);
    if (!files.length) return;
    if (!story.gallery) story.gallery = [];

    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () {
        return fileToDataURL(file).then(function (dataUrl) {
          var base64 = dataUrl.split(",")[1];
          var ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          var name = "photo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "." + ext;
          var path = CONFIG.photosPath + name;
          story.gallery.push(path);
          var idx = story.gallery.length - 1;
          story["__galleryPreview_" + idx] = dataUrl;
          pendingImages.push({ name: name, base64: base64, path: path });
        });
      });
    });

    chain.then(function () {
      renderAll();
      toast(files.length + " photo(s) ready");
    });
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════
function saveToGitHub() {
  var token = sessionStorage.getItem("gh_token") || CONFIG.token || "";
  if (!token) { toast("No token"); return Promise.resolve(); }
  CONFIG.token = token;

  setSavePill("Saving...", "saving");

  var uploads = pendingImages.map(function (img) {
    return putFile(img.path, img.base64, "Add " + img.name);
  });

  return Promise.all(uploads).then(function () {
    (story.moments || []).forEach(function (m) {
      if (m.__pendingPhoto) { m.photo = m.__pendingPhoto; delete m.__pendingPhoto; }
      if (typeof m.photo === "string" && m.photo.indexOf("data:") === 0) m.photo = "";
      delete m.__preview;
    });

    if (Array.isArray(story.gallery)) {
      story.gallery = story.gallery.filter(function (src) {
        return !(typeof src === "string" && src.indexOf("data:") === 0);
      });
    }

    Object.keys(story).forEach(function (k) {
      if (k.indexOf("__galleryPreview_") === 0) delete story[k];
    });
    pendingImages = [];

    var json = JSON.stringify(story, null, 2);
    if (json.length > 5000000) throw new Error("story.json too large");

    var base64 = btoa(unescape(encodeURIComponent(json)));
    return putFile(CONFIG.storyPath, base64, "Update story");
  }).then(function () {
    setSavePill("Saved", "saved");
    toast("Saved!");
  }).catch(function (e) {
    console.error(e);
    setSavePill("Error: " + e.message, "error");
    toast("Save failed: " + e.message);
  });
}

function putFile(path, base64Content, message) {
  var url = API + "/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + path;
  var headers = {
    "Authorization": "Bearer " + CONFIG.token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };

  return fetch(url, { headers: headers })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (existing) {
      var body = { message: message, content: base64Content, branch: CONFIG.branch };
      if (existing && existing.sha) body.sha = existing.sha;

      return fetch(url, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(body)
      });
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (err) {
          throw new Error(err.message || ("HTTP " + res.status));
        });
      }
      return res.json();
    });
}

// ═══════════════════════════════════════════════════════════
// MUSIC
// ═══════════════════════════════════════════════════════════
function changeMusic() {
  var input = document.getElementById("musicInput");
  input.value = "";
  input.onchange = function () {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast("Audio file too large"); return; }
    fileToDataURL(file).then(function (dataUrl) {
      var base64 = dataUrl.split(",")[1];
      var ext = (file.name.split(".").pop() || "mp3").toLowerCase();
      var name = "song-" + Date.now() + "." + ext;
      var path = CONFIG.musicPath + name;
      pendingImages.push({ name: name, base64: base64, path: path });
      story.songFile = path;
      story.songTitle = file.name.replace(/\.[^.]+$/, "");
      var mt = document.getElementById("musicTitle");
      if (mt) mt.textContent = story.songTitle;
      var audio = document.getElementById("bgMusic");
      if (audio) audio.src = dataUrl;
      var mp = document.getElementById("musicPlayer");
      if (mp) mp.classList.remove("hidden");
      toast("Music ready");
    });
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════
function openEditor() {
  document.body.classList.add("edit-mode");
  var et = document.getElementById("editToolbar");
  if (et) et.classList.add("open");
  toast("Edit mode on");
}

function closeEditor() {
  document.body.classList.remove("edit-mode");
  var et = document.getElementById("editToolbar");
  if (et) et.classList.remove("open");
}

function initMusicPlayer() {
  var audio = document.getElementById("bgMusic");
  var btn = document.getElementById("musicBtn");
  var player = document.getElementById("musicPlayer");
  if (!btn || !audio || !player) return;
  var playIcon = btn.querySelector(".music-icon-play");
  var pauseIcon = btn.querySelector(".music-icon-pause");

  var tryPlay = function () {
    if (!audio.src) return;
    audio.play().then(function () {
      player.classList.add("playing");
      if (playIcon) playIcon.classList.add("hidden");
      if (pauseIcon) pauseIcon.classList.remove("hidden");
    }).catch(function () {});
  };
  document.addEventListener("click", tryPlay, { once: true });

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (!audio.src) return;
    if (audio.paused) {
      audio.play().then(function () {
        player.classList.add("playing");
        if (playIcon) playIcon.classList.add("hidden");
        if (pauseIcon) pauseIcon.classList.remove("hidden");
      }).catch(function () {});
    } else {
      audio.pause();
      player.classList.remove("playing");
      if (playIcon) playIcon.classList.remove("hidden");
      if (pauseIcon) pauseIcon.classList.add("hidden");
    }
  });
}

function initCounter() {
  function tick() {
    var start = new Date(story.startDate || "2023-01-01T00:00:00");
    var diff = Date.now() - start.getTime();
    if (diff < 0) return;
    var s = Math.floor(diff / 1000);
    var d = document.getElementById("days");
    var h = document.getElementById("hours");
    var m = document.getElementById("minutes");
    var sec = document.getElementById("seconds");
    if (d) d.textContent = Math.floor(s / 86400).toLocaleString();
    if (h) h.textContent = Math.floor((s % 86400) / 3600);
    if (m) m.textContent = Math.floor((s % 3600) / 60);
    if (sec) sec.textContent = s % 60;
  }
  tick();
  setInterval(tick, 1000);
}

function initSurprise() {
  var btn = document.getElementById("heartBtn");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var t = document.getElementById("finalText");
    if (t) {
      t.textContent = story.surprise || "I love you";
      t.style.color = "var(--pink-soft)";
    }
    var rain = document.getElementById("heartRain");
    if (rain) {
      var hearts = ["❤", "💕", "💖", "💗", "💘", "💝", "🌸", "✨"];
      for (var i = 0; i < 50; i++) {
        var h = document.createElement("div");
        h.className = "heart-drop";
        h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        h.style.left = Math.random() * 100 + "vw";
        h.style.fontSize = (18 + Math.random() * 24) + "px";
        h.style.animationDuration = (3 + Math.random() * 3) + "s";
        h.style.animationDelay = (Math.random() * 1.5) + "s";
        rain.appendChild(h);
        (function (node) {
          setTimeout(function () { node.remove(); }, 8000);
        })(h);
      }
    }
    var sp = btn.querySelector("span");
    if (sp) sp.textContent = "I love you";
  });
}

function initPetals() {
  var wrap = document.getElementById("petals");
  if (!wrap) return;
  var shapes = ["❤", "🌸", "✿", "❀", "♥", "✾"];
  for (var i = 0; i < 18; i++) {
    var p = document.createElement("div");
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
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".moment").forEach(function (m) { obs.observe(m); });
}

function openLightbox(src) {
  var lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.querySelector("img").src = src;
  lb.classList.add("open");
}

// ═══════════════════════════════════════════════════════════
// DELEGATED CLICKS
// ═══════════════════════════════════════════════════════════
document.addEventListener("click", function (e) {
  var t = e.target;
  if (!t.dataset || !t.dataset.act) return;
  var i = parseInt(t.dataset.i);

  if (t.dataset.act === "view-moment") {
    e.stopPropagation();
    var src = (story.moments[i] && (story.moments[i].__preview || story.moments[i].photo)) || "";
    if (src) openLightbox(src);
    return;
  }
  if (t.dataset.act === "view-gallery") {
    e.stopPropagation();
    var s2 = story["__galleryPreview_" + i] || (story.gallery && story.gallery[i]);
    if (s2) openLightbox(s2);
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
    if (t.dataset.act === "rm-milestone") {
    e.stopPropagation();
    if (!confirm("Remove this milestone?")) return;
    MILESTONES.splice(i, 1);
    renderMilestones();
    toast("Milestone removed");
  }
  if (t.dataset.act === "pick-moment") {
    e.stopPropagation();
    pickImage(function (o) {
      var path = CONFIG.photosPath + o.name;
      pendingImages.push({ name: o.name, base64: o.base64, path: path });
      story.moments[i].__preview = o.dataUrl;
      story.moments[i].__pendingPhoto = path;
      story.moments[i].photo = path;
      renderAll();
      toast("Photo ready");
    });
  }
  if (t.dataset.act === "pick-gallery") {
    e.stopPropagation();
    pickImage(function (o) {
      var path = CONFIG.photosPath + o.name;
      pendingImages.push({ name: o.name, base64: o.base64, path: path });
      story.gallery[i] = path;
      story["__galleryPreview_" + i] = o.dataUrl;
      renderAll();
      toast("Photo ready");
    });
  }
});

document.addEventListener("contextmenu", function (e) {
  if (e.target.tagName === "IMG") e.preventDefault();
});

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", function () {
  checkEditorAccess();
  loadStory().then(function () {
    renderAll();
    initMusicPlayer();
    initCounter();
    initSurprise();
    initPetals();

    var startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.onclick = function () {
      var ts = document.querySelector(".timeline-section");
      if (ts) ts.scrollIntoView({ behavior: "smooth" });
    };

    var editToggle = document.getElementById("editToggle");
    if (editToggle) editToggle.onclick = function () {
      if (document.body.classList.contains("edit-mode")) closeEditor();
      else openEditor();
    };

    var etDone = document.getElementById("etDone");
    if (etDone) etDone.onclick = function () {
      saveToGitHub().then(function () { closeEditor(); });
    };

    var etAddMoment = document.getElementById("etAddMoment");
    if (etAddMoment) etAddMoment.onclick = addMoment;

    var etAddPhoto = document.getElementById("etAddPhoto");
    if (etAddPhoto) etAddPhoto.onclick = addPhotosFromInput;

    var etChangeMusic = document.getElementById("etChangeMusic");
    if (etChangeMusic) etChangeMusic.onclick = changeMusic;

    var lightbox = document.getElementById("lightbox");
    if (lightbox) lightbox.onclick = function () { lightbox.classList.remove("open"); };

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (lightbox) lightbox.classList.remove("open");
        if (document.body.classList.contains("edit-mode")) closeEditor();
      }
    });
  });
});
