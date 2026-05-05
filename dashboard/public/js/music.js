// ═══════════════════════════════════
// MUSIC PAGE — CLIENT LOGIC
// ═══════════════════════════════════

let currentGuildId = null;
let isDraggingVolume = false;
let lastCoverUrl = "";

function covUrl(u) {
  const fb = "https://i.imgur.com/2ce2t5e.png";
  return typeof safeHttpsUrl === "function"
    ? safeHttpsUrl(u, fb)
    : u
      ? String(u).trim().startsWith("https:")
        ? u
        : fb
      : fb;
}

let stateFetchBusy = false;
let lastNpUri = "";
let lastQueueSig = "";
let lastLoop = null;
let lastAutoplay = null;

function resetPlayerFingerprints() {
  lastNpUri = "";
  lastQueueSig = "";
  lastLoop = null;
  lastAutoplay = null;
  lastCoverUrl = "";
}

function formatTime(ms) {
  if (isNaN(ms) || ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function queueSignature(data) {
  const q = data.queue || [];
  return (
    String(data.queueCount) +
    "\n" +
    q.map((s, i) => i + ":" + (s.uri || "") + ":" + (s.title || "")).join("\n")
  );
}

function fillSelectOptions(selectEl, placeholderText, rows, getId, getName) {
  while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholderText;
  selectEl.appendChild(opt0);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = String(getId(r) != null ? getId(r) : "");
    if (!id) continue;
    const o = document.createElement("option");
    o.value = id;
    o.textContent = String(getName(r) != null ? getName(r) : "");
    selectEl.appendChild(o);
  }
}

function renderQueueList(container, songs) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (!songs.length) {
    const empty = document.createElement("div");
    empty.className = "queue-empty";
    empty.textContent = "Queue is empty";
    container.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const row = document.createElement("div");
    row.className = "queue-item";

    const num = document.createElement("div");
    num.className = "q-num";
    num.textContent = String(i + 1);

    const img = document.createElement("img");
    img.className = "q-img";
    img.loading = "lazy";
    img.alt = "";
    img.src = covUrl(song.cover);

    const info = document.createElement("div");
    info.className = "q-info";
    const t = document.createElement("div");
    t.className = "q-title";
    t.textContent = song.title != null ? String(song.title) : "";
    const a = document.createElement("div");
    a.className = "q-author";
    a.textContent = song.author != null ? String(song.author) : "";
    info.appendChild(t);
    info.appendChild(a);

    row.appendChild(num);
    row.appendChild(img);
    row.appendChild(info);
    frag.appendChild(row);
  }
  container.appendChild(frag);
}

// ── State Update ──
async function updateState() {
  if (stateFetchBusy) return;
  stateFetchBusy = true;
  try {
    const res = await fetch("/api/music/status");
    const data = await res.json();

    const joinUI = document.getElementById("joinUI");
    const idleUI = document.getElementById("idleUI");
    const playerUI = document.getElementById("playerUI");

    if (data.isPlaying) {
      joinUI.style.display = "none";
      idleUI.style.display = "none";
      playerUI.style.display = "grid";
      currentGuildId = data.activeGuildId;
      updatePlayerUI(data);
    } else if (data.isConnectedToVoice) {
      resetPlayerFingerprints();
      joinUI.style.display = "none";
      playerUI.style.display = "none";
      idleUI.style.display = "flex";
      currentGuildId = data.activeGuildId;
      document.getElementById("idleGuildName").textContent =
        data.guildName || "";
      document.getElementById("idleChannelName").textContent =
        data.channelName || "";
      document.getElementById("idleGuildIcon").src = covUrl(data.guildIcon);
    } else {
      resetPlayerFingerprints();
      playerUI.style.display = "none";
      idleUI.style.display = "none";
      joinUI.style.display = "flex";
      currentGuildId = null;
      const srv = document.getElementById("serverSelect");
      if (srv && srv.children.length <= 1) loadServers();
    }
  } catch (e) {
    if (typeof console !== "undefined" && console.debug)
      console.debug("[music] status:", e);
  } finally {
    stateFetchBusy = false;
  }
}

// ── Player UI Update ──
function updatePlayerUI(data) {
  const np = data.nowPlaying;
  const npUri = np && np.url ? String(np.url) : "";
  const fullMeta = npUri !== lastNpUri;
  const qSig = queueSignature(data);
  const queueDirty = qSig !== lastQueueSig;

  if (fullMeta) {
    lastNpUri = npUri;
    lastQueueSig = "";
    document.getElementById("guildName").textContent = data.guildName || "";
    document.getElementById("channelName").textContent = data.channelName || "";
    document.getElementById("guildIcon").src = covUrl(data.guildIcon);

    document.getElementById("trackTitle").textContent =
      np && np.title != null ? String(np.title) : "";
    document.getElementById("trackArtist").textContent =
      np && np.author != null ? String(np.author) : "";

    const coverUrlRaw = np ? np.cover : "";
    const coverUrl = covUrl(coverUrlRaw);
    const coverEl = document.getElementById("trackCover");
    coverEl.src = coverUrl;

    if (coverUrl !== lastCoverUrl) {
      lastCoverUrl = coverUrl;
    }

    const wavebar = document.getElementById("wavebar");
    if (wavebar) {
      wavebar.classList.add("playing");
      wavebar.classList.remove("paused");
    }
  }

  const percent = data.duration
    ? Math.min(100, (data.position / data.duration) * 100)
    : 0;
  document.getElementById("seekbarFill").style.width = percent + "%";
  document.getElementById("currTime").textContent = formatTime(data.position);
  document.getElementById("totalTime").textContent = formatTime(data.duration);

  if (fullMeta || data.loop !== lastLoop) {
    lastLoop = data.loop;
    updateLoopBtn(data.loop);
  }
  if (fullMeta || data.autoplay !== lastAutoplay) {
    lastAutoplay = data.autoplay;
    updateAutoplayBtn(data.autoplay);
  }

  if (!isDraggingVolume) {
    const vol = data.volume !== undefined ? data.volume : 100;
    document.getElementById("volumeSlider").value = vol;
    document.getElementById("volumeVal").textContent = vol + "%";
  }

  document.getElementById("queueBadge").textContent = data.queueCount;
  const list = document.getElementById("queueList");
  if (queueDirty || fullMeta) {
    lastQueueSig = qSig;
    renderQueueList(list, data.queue || []);
  }
}

function updateLoopBtn(loop) {
  const btn = document.getElementById("btnLoop");
  btn.className = "pill-btn";
  const icon =
    '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>';
  if (loop === "track") {
    btn.innerHTML = icon + " Track";
    btn.classList.add("active-track");
  } else if (loop === "queue") {
    btn.innerHTML = icon + " Queue";
    btn.classList.add("active-queue");
  } else {
    btn.innerHTML = icon + " Off";
  }
}

function updateAutoplayBtn(autoplay) {
  const btn = document.getElementById("btnAutoplay");
  const icon =
    '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>';
  btn.className = "pill-btn";
  if (autoplay) {
    btn.innerHTML = icon + " On";
    btn.classList.add("active-autoplay");
  } else {
    btn.innerHTML = icon + " Off";
  }
}

// ── Server / Channel Loading ──
async function loadServers() {
  const res = await fetch("/api/discord/guilds");
  const guilds = await res.json();
  const sel = document.getElementById("serverSelect");
  fillSelectOptions(
    sel,
    "Select Server",
    Array.isArray(guilds) ? guilds : [],
    (g) => g.id,
    (g) => g.name,
  );
}

async function loadChannels() {
  const guildId = document.getElementById("serverSelect").value;
  const sel = document.getElementById("channelSelect");
  if (!guildId) {
    fillSelectOptions(
      sel,
      "Select Voice Channel",
      [],
      () => "",
      () => "",
    );
    return;
  }
  fillSelectOptions(
    sel,
    "Loading...",
    [],
    () => "",
    () => "",
  );
  const res = await fetch(
    `/api/discord/channels/${encodeURIComponent(guildId)}`,
  );
  const channels = await res.json();
  fillSelectOptions(
    sel,
    "Select Voice Channel",
    Array.isArray(channels) ? channels : [],
    (c) => c.id,
    (c) => c.name,
  );
}

// ── Actions ──
function setJoinFeedback(msg) {
  const el = document.getElementById("joinFeedback");
  if (el) el.textContent = msg || "";
}

async function joinChannel() {
  const guildId = document.getElementById("serverSelect").value;
  const channelId = document.getElementById("channelSelect").value;
  setJoinFeedback("");
  if (!guildId || !channelId) {
    setJoinFeedback("Pilih server dan voice channel dulu.");
    return;
  }
  const btn = document.querySelector("#joinUI .btn-primary");
  if (!btn) return;
  const orig = btn.innerText;
  btn.disabled = true;
  btn.innerText = "Joining...";
  try {
    const res = await fetch("/api/music/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, channelId }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok || data.success === false) {
      setJoinFeedback(data.message || "Gagal join voice.");
      btn.innerText = orig;
      btn.disabled = false;
      return;
    }
    setJoinFeedback("");
    [400, 900, 1800, 3200].forEach((ms) => setTimeout(() => updateState(), ms));
    setTimeout(() => {
      btn.innerText = orig;
      btn.disabled = false;
    }, 2000);
  } catch (e) {
    setJoinFeedback("Error jaringan.");
    btn.innerText = orig;
    btn.disabled = false;
  }
}

async function leaveChannel() {
  if (!currentGuildId) return;
  await fetch("/api/music/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: currentGuildId }),
  });
}

async function skipSong() {
  await fetch("/api/music/skip", { method: "POST" });
  updateState();
}
async function prevSong() {
  await fetch("/api/music/previous", { method: "POST" });
  updateState();
}

async function stopMusic() {
  if (confirm("Stop music and leave voice?")) {
    await fetch("/api/music/stop", { method: "POST" });
    updateState();
  }
}

async function seek(amount) {
  if (!currentGuildId) return;
  await fetch("/api/music/seek", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: currentGuildId, amount }),
  });
  updateState();
}

async function toggleLoop() {
  if (!currentGuildId) return;
  const res = await fetch("/api/music/loop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: currentGuildId }),
  });
  const data = await res.json();
  if (data.success) showToast("Loop: " + String(data.loop).toUpperCase());
  updateState();
}

async function toggleAutoplay() {
  if (!currentGuildId) return;
  const res = await fetch("/api/music/autoplay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: currentGuildId }),
  });
  const data = await res.json();
  if (data.success) showToast("Autoplay: " + (data.autoplay ? "ON" : "OFF"));
  updateState();
}

// ── Modal ──
function openPlayModal() {
  document.getElementById("playModal").classList.add("open");
  document.getElementById("playInput").focus();
  loadFavorites();
}

function closePlayModal() {
  document.getElementById("playModal").classList.remove("open");
}

function setFavInline(container, message, color) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const sp = document.createElement("span");
  if (color) sp.style.color = color;
  sp.textContent = message;
  container.appendChild(sp);
}

async function loadFavorites() {
  const container = document.getElementById("favContainer");
  setFavInline(container, "Loading...", "#52525b");
  try {
    const res = await fetch("/api/music/playlists");
    const data = await res.json();
    if (data.success && data.playlists && data.playlists.includes("fav")) {
      container.textContent = "";
      const btn = document.createElement("button");
      btn.className = "fav-btn";
      btn.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Load Favorites';
      btn.onclick = () => loadPlaylist("fav");
      container.appendChild(btn);
    } else {
      setFavInline(
        container,
        "No favorites yet. Use !fav in Discord.",
        "#52525b",
      );
    }
  } catch (e) {
    setFavInline(container, "Error loading favorites.", "#ef4444");
  }
}

async function loadPlaylist(name) {
  if (!currentGuildId) return;
  const container = document.getElementById("favContainer");
  setFavInline(container, "Loading playlist...", "#a855f7");
  try {
    const res = await fetch("/api/music/playlist/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: currentGuildId, name }),
    });
    const data = await res.json();
    if (data.success) {
      setFavInline(
        container,
        "Loaded " + String(data.added != null ? data.added : 0) + " tracks!",
        "#4ade80",
      );
      setTimeout(closePlayModal, 800);
      updateState();
    } else {
      setFavInline(
        container,
        data.message != null ? String(data.message) : "Error",
        "#ef4444",
      );
    }
  } catch (e) {
    setFavInline(container, "Network error", "#ef4444");
  }
}

async function playSong() {
  const input = document.getElementById("playInput");
  const query = input.value.trim();
  if (!query) return;

  if (!currentGuildId) {
    showToast("⚠️ Join a voice channel first!");
    return;
  }

  const btn = document.querySelector("#playModal .btn-primary");
  const origText = btn.innerText;
  btn.innerText = "Searching...";

  try {
    const res = await fetch("/api/music/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: currentGuildId, query }),
    });
    const result = await res.json();
    if (result.success) {
      btn.innerText = "Added!";
      setTimeout(() => {
        closePlayModal();
        input.value = "";
        btn.innerText = origText;
      }, 800);
      updateState();
    } else {
      btn.innerText = origText;
      showToast("Error: " + (result.message || "Failed"));
    }
  } catch (e) {
    btn.innerText = origText;
    showToast("Network error");
  }
}

function handleEnter(e) {
  if (e.key === "Enter") playSong();
}

// ── Toast ──
let toastTimeout;
// showToast tersedia global via dashboard-utils.js

// ── Volume ──
function initVolume() {
  const slider = document.getElementById("volumeSlider");
  if (!slider) return;

  slider.addEventListener("mousedown", () => {
    isDraggingVolume = true;
  });
  slider.addEventListener("touchstart", () => {
    isDraggingVolume = true;
  });

  slider.addEventListener("input", function () {
    document.getElementById("volumeVal").textContent = this.value + "%";
  });

  async function sendVolume() {
    if (!currentGuildId) return;
    await fetch("/api/music/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: currentGuildId, volume: slider.value }),
    });
    setTimeout(() => {
      isDraggingVolume = false;
    }, 500);
  }

  slider.addEventListener("mouseup", sendVolume);
  slider.addEventListener("touchend", sendVolume);
  slider.addEventListener("change", sendVolume);
}

// ── Polling: lebih jarang saat tab hidden; hindari fetch overlap ──
let musicPollTimer = null;

function musicPollIntervalMs() {
  return document.hidden ? 6000 : 2000;
}

function startMusicPolling() {
  if (musicPollTimer) clearInterval(musicPollTimer);
  musicPollTimer = setInterval(updateState, musicPollIntervalMs());
}

document.addEventListener("visibilitychange", () => {
  startMusicPolling();
  if (!document.hidden) updateState();
});

// ── Init ──
initVolume();
startMusicPolling();
updateState();
