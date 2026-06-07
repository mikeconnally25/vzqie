const socket = io();

const WHEEL_SPIN_MS = 5200;

const els = {
  siteTitle: document.getElementById("site-title"),
  keywordEnabled: document.getElementById("keyword-enabled"),
  keywordInput: document.getElementById("keyword-input"),
  streamerPill: document.getElementById("streamer-pill"),
  viewerPill: document.getElementById("viewer-pill"),
  streamerBtn: document.getElementById("streamer-btn"),
  streamerModal: document.getElementById("streamer-modal"),
  streamerModalClose: document.getElementById("streamer-modal-close"),
  streamerSignedIn: document.getElementById("streamer-signed-in"),
  signedInStreamer: document.getElementById("signed-in-streamer"),
  streamerForms: document.getElementById("streamer-forms"),
  streamerSetupHint: document.getElementById("streamer-setup-hint"),
  streamerSignupForm: document.getElementById("streamer-signup-form"),
  streamerLoginForm: document.getElementById("streamer-login-form"),
  streamerLogoutBtn: document.getElementById("streamer-logout-btn"),
  streamerTabs: document.querySelectorAll("[data-streamer-tab]"),
  viewerForms: document.getElementById("viewer-forms"),
  viewerSignedIn: document.getElementById("viewer-signed-in"),
  signedInViewerKick: document.getElementById("signed-in-viewer-kick"),
  viewerKickUsernameInput: document.getElementById("viewer-kick-username-input"),
  kickOAuthLink: document.getElementById("kick-oauth-link"),
  kickOAuthLinked: document.getElementById("kick-oauth-linked"),
  kickOAuthLinkedName: document.getElementById("kick-oauth-linked-name"),
  viewerChatroomField: document.getElementById("viewer-chatroom-field"),
  viewerChatroomIdInput: document.getElementById("viewer-chatroom-id-input"),
  verifyViewerKickBtn: document.getElementById("verify-viewer-kick-btn"),
  viewerSignupForm: document.getElementById("viewer-signup-form"),
  viewerLoginForm: document.getElementById("viewer-login-form"),
  viewerLogoutBtn: document.getElementById("viewer-logout-btn"),
  viewerTabs: document.querySelectorAll("[data-viewer-tab]"),
  wheelPanel: document.getElementById("wheel-panel"),
  wheelViewport: document.getElementById("wheel-viewport"),
  wheelTrack: document.getElementById("wheel-track"),
  wheelResult: document.getElementById("wheel-result"),
  connection: document.getElementById("connection-pill"),
  drawBtn: document.getElementById("draw-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  drawCount: document.getElementById("draw-count"),
  statEligible: document.getElementById("stat-eligible"),
  statEntries: document.getElementById("stat-entries"),
  statWinners: document.getElementById("stat-winners"),
  entries: document.getElementById("entries-list"),
  eligible: document.getElementById("eligible-list"),
  winners: document.getElementById("winners-list"),
  toast: document.getElementById("toast"),
};

let dashboardState = null;
let isSpinning = false;
let isAdmin = false;
let needsSetup = false;
let kickOAuthConfigured = false;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function riskBadge(level) {
  if (!level) return "";
  const icon = { LOW: "🟢", MEDIUM: "🟡", HIGH: "🔴" }[level] ?? "";
  return `<span class="badge badge-${level.toLowerCase()}">${icon} ${level}</span>`;
}

function statusLabel(entry) {
  if (entry.status === "blocked" && entry.blockedReason) {
    return entry.blockedReason;
  }

  return {
    entered: "Entered",
    blocked: "Blocked",
  }[entry.status] ?? entry.status;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
}

function renderList(container, items, renderItem, emptyText) {
  if (!items.length) {
    container.className = "list empty-state";
    container.textContent = emptyText;
    return;
  }

  container.className = "list";
  container.innerHTML = items.map(renderItem).join("");
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function randomRarityClass() {
  const roll = Math.random();
  if (roll > 0.92) return "wheel-item-legendary";
  if (roll > 0.78) return "wheel-item-epic";
  return "wheel-item-rare";
}

function getWheelItemStride() {
  const item = els.wheelTrack.querySelector(".wheel-item:not(.wheel-item-placeholder)");
  if (!item) {
    return 166;
  }

  const styles = getComputedStyle(els.wheelTrack);
  const gap = Number.parseFloat(styles.columnGap || styles.gap || "10");
  return item.getBoundingClientRect().width + gap;
}

function buildReelItems(usernames, winnerUsername) {
  const pool = usernames.length ? usernames : [winnerUsername];
  const totalTiles = 58 + Math.floor(Math.random() * 12);
  const winnerIndex = totalTiles - 7 - Math.floor(Math.random() * 4);
  const tiles = [];

  for (let i = 0; i < totalTiles; i += 1) {
    tiles.push({
      username: i === winnerIndex ? winnerUsername : pool[Math.floor(Math.random() * pool.length)],
      isWinner: i === winnerIndex,
      rarity: i === winnerIndex ? "wheel-item-legendary" : randomRarityClass(),
    });
  }

  return { tiles, winnerIndex };
}

function renderWheelIdle(eligible) {
  if (isSpinning) {
    return;
  }

  els.wheelPanel.classList.remove("wheel-won");
  els.wheelResult.classList.add("hidden");
  els.wheelResult.textContent = "";

  if (!eligible.length) {
    els.wheelTrack.style.transition = "none";
    els.wheelTrack.style.transform = "translateX(0)";
    els.wheelTrack.innerHTML =
      '<div class="wheel-item wheel-item-placeholder">Waiting for eligible entries…</div>';
    return;
  }

  const preview = [];
  for (let i = 0; i < 12; i += 1) {
    preview.push({
      username: eligible[i % eligible.length].username,
      isWinner: false,
      rarity: randomRarityClass(),
    });
  }

  els.wheelTrack.style.transition = "none";
  els.wheelTrack.style.transform = "translateX(0)";
  els.wheelTrack.innerHTML = preview
    .map(
      (tile) => `
        <div class="wheel-item ${tile.rarity}">
          ${escapeHtml(tile.username)}
        </div>
      `
    )
    .join("");
}

async function spinWheel(usernames, winnerUsername) {
  const { tiles, winnerIndex } = buildReelItems(usernames, winnerUsername);

  els.wheelPanel.classList.remove("wheel-won");
  els.wheelPanel.classList.add("wheel-spinning");
  els.wheelResult.classList.add("hidden");
  els.wheelResult.textContent = "";

  els.wheelTrack.innerHTML = tiles
    .map(
      (tile) => `
        <div class="wheel-item ${tile.rarity}${tile.isWinner ? " wheel-item-winner" : ""}">
          ${escapeHtml(tile.username)}
        </div>
      `
    )
    .join("");

  await nextFrame();

  const stride = getWheelItemStride();
  const offset =
    winnerIndex * stride - els.wheelViewport.offsetWidth / 2 + stride / 2;

  els.wheelTrack.style.transition = "none";
  els.wheelTrack.style.transform = "translateX(0)";

  await nextFrame();

  els.wheelTrack.style.transition = `transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.08, 0.82, 0.17, 1)`;
  els.wheelTrack.style.transform = `translateX(-${offset}px)`;

  await wait(WHEEL_SPIN_MS + 120);

  els.wheelPanel.classList.remove("wheel-spinning");
  els.wheelPanel.classList.add("wheel-won");
  els.wheelResult.classList.remove("hidden");
  els.wheelResult.textContent = `🏆 ${winnerUsername} wins!`;
}

function updateAdminControls() {
  const locked = !isAdmin;
  els.drawBtn.disabled = locked || isSpinning;
  els.refreshBtn.disabled = locked;
  els.keywordEnabled.disabled = locked;
  els.keywordInput.disabled = locked || !els.keywordEnabled.checked;
  els.drawBtn.title = locked ? "Streamer sign-in required" : "";
}

function openStreamerModal() {
  els.streamerModal.classList.remove("hidden");
  els.streamerModal.setAttribute("aria-hidden", "false");
}

function closeStreamerModal() {
  els.streamerModal.classList.add("hidden");
  els.streamerModal.setAttribute("aria-hidden", "true");
}

function renderStreamerState(user) {
  isAdmin = Boolean(user);
  updateAdminControls();

  if (user) {
    els.streamerPill.textContent = user.username;
    els.streamerPill.classList.remove("hidden");
    els.streamerBtn.classList.add("hidden");
    els.signedInStreamer.textContent = user.username;
    els.streamerSignedIn.classList.remove("hidden");
    els.streamerForms.classList.add("hidden");
    closeStreamerModal();
    return;
  }

  els.streamerPill.classList.add("hidden");
  els.streamerBtn.classList.remove("hidden");
  els.streamerSignedIn.classList.add("hidden");
  els.streamerForms.classList.remove("hidden");
  els.streamerSetupHint.classList.toggle("hidden", !needsSetup);
  els.streamerTabs.forEach((button) => {
    button.classList.toggle("hidden", needsSetup && button.dataset.streamerTab === "login");
  });
  els.streamerLoginForm.classList.toggle("hidden", needsSetup);
  if (needsSetup) {
    setStreamerTab("signup");
  }
}

function renderViewerState(viewer) {
  if (viewer) {
    els.viewerPill.textContent = viewer.kickUsername;
    els.viewerPill.classList.remove("hidden");
    els.signedInViewerKick.textContent = `${viewer.kickUsername} (${viewer.kickChatroomId})`;
    els.viewerSignedIn.classList.remove("hidden");
    els.viewerForms.classList.add("hidden");
    return;
  }

  els.viewerPill.classList.add("hidden");
  els.viewerSignedIn.classList.add("hidden");
  els.viewerForms.classList.remove("hidden");
}

function renderPendingKickLink(pending) {
  if (!pending) {
    els.kickOAuthLinked.classList.add("hidden");
    els.viewerKickUsernameInput.readOnly = false;
    return;
  }

  els.kickOAuthLinked.classList.remove("hidden");
  els.kickOAuthLinkedName.textContent = pending.slug;
  els.viewerKickUsernameInput.value = pending.slug;
  els.viewerKickUsernameInput.readOnly = true;
  els.viewerChatroomField.classList.add("hidden");
}

async function loadSession() {
  const response = await fetch("/api/auth/me");
  const result = await response.json();
  needsSetup = Boolean(result.needsSetup);
  kickOAuthConfigured = Boolean(result.kickOAuthConfigured);
  els.kickOAuthLink.classList.toggle("hidden", !kickOAuthConfigured);
  renderStreamerState(result.user);
  renderViewerState(result.viewer);
  renderPendingKickLink(result.pendingKickLink);

  if (needsSetup) {
    openStreamerModal();
  }
}

function setStreamerTab(tab) {
  for (const button of els.streamerTabs) {
    button.classList.toggle("active", button.dataset.streamerTab === tab);
  }

  els.streamerSignupForm.classList.toggle("hidden", tab !== "signup");
  els.streamerLoginForm.classList.toggle("hidden", tab !== "login");
}

function setViewerTab(tab) {
  for (const button of els.viewerTabs) {
    button.classList.toggle("active", button.dataset.viewerTab === tab);
  }

  els.viewerSignupForm.classList.toggle("hidden", tab !== "signup");
  els.viewerLoginForm.classList.toggle("hidden", tab !== "login");
}

async function submitStreamerForm(url, form) {
  const data = new FormData(form);
  const body = Object.fromEntries(data.entries());

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast(result.error ?? "Streamer account request failed");
    return;
  }

  form.reset();
  needsSetup = false;
  renderStreamerState(result.user);
  showToast(`Welcome, ${result.user.username}`);
}

async function submitViewerForm(url, form) {
  const data = new FormData(form);
  const body = Object.fromEntries(data.entries());

  if (!body.kickChatroomId) {
    delete body.kickChatroomId;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast(result.error ?? "Viewer account request failed");
    return;
  }

  form.reset();
  els.viewerChatroomField.classList.add("hidden");
  renderViewerState(result.viewer);
  showToast(`Linked Kick account: ${result.viewer.kickUsername}`);
}

function syncKeywordControls(state) {
  if (document.activeElement !== els.keywordInput) {
    els.keywordInput.value = state.entryKeyword;
  }

  if (document.activeElement !== els.keywordEnabled) {
    els.keywordEnabled.checked = state.keywordEnabled;
  }

  updateAdminControls();
}

function renderState(state) {
  dashboardState = state;
  syncKeywordControls(state);

  const channelLabel = state.channel && state.channel !== "not-configured"
    ? `${state.channel} Giveaway`
    : "Kick Giveaway";
  els.siteTitle.textContent = channelLabel;
  document.title = channelLabel;

  els.statEligible.textContent = state.eligible.length;
  els.statEntries.textContent = state.recentEntries.length;
  els.statWinners.textContent = state.winners.length;

  els.connection.textContent = state.chatConnected ? "Live" : "Offline";
  els.connection.className = `pill ${state.chatConnected ? "pill-online" : "pill-offline"}`;

  renderWheelIdle(state.eligible);

  renderList(
    els.entries,
    state.recentEntries,
    (entry) => `
      <article class="row">
        <div class="row-main">
          <div class="row-title">${escapeHtml(entry.username)}</div>
          <div class="row-meta">${escapeHtml(entry.message)}</div>
        </div>
        <div>
          <span class="status-${entry.status}">${escapeHtml(statusLabel(entry))}</span>
          ${entry.riskLevel ? riskBadge(entry.riskLevel) : ""}
        </div>
      </article>
    `,
    "Waiting for chat entries…"
  );

  renderList(
    els.eligible,
    state.eligible,
    (entry) => `
      <article class="row">
        <div class="row-main">
          <div class="row-title">${escapeHtml(entry.username)}</div>
          <div class="row-meta">Joined ${new Date(entry.timestamp).toLocaleTimeString()}</div>
        </div>
        ${riskBadge(entry.riskLevel)}
      </article>
    `,
    "No eligible viewers yet"
  );

  renderList(
    els.winners,
    state.winners,
    (winner) => `
      <article class="row">
        <div class="row-main">
          <div class="row-title">🏆 ${escapeHtml(winner.username)}</div>
          <div class="row-meta">${new Date(winner.timestamp).toLocaleString()}</div>
        </div>
      </article>
    `,
    "No winners yet"
  );
}

async function saveKeywordSettings(partial = {}) {
  if (!isAdmin) {
    showToast("Streamer sign-in required");
    return;
  }

  const keyword =
    partial.keyword !== undefined ? partial.keyword : els.keywordInput.value;
  const enabled =
    partial.enabled !== undefined ? partial.enabled : els.keywordEnabled.checked;

  const response = await fetch("/api/settings/keyword", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, enabled }),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast(result.error ?? "Failed to update keyword");
    return;
  }

  renderState(result.state);
  showToast(
    enabled ? `Keyword set to "${result.state.entryKeyword}"` : "Keyword off — all chat counts"
  );
}

els.keywordEnabled.addEventListener("change", () => {
  saveKeywordSettings({ enabled: els.keywordEnabled.checked });
});

els.keywordInput.addEventListener("change", () => {
  if (!els.keywordEnabled.checked) {
    return;
  }
  saveKeywordSettings({ keyword: els.keywordInput.value });
});

els.keywordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    els.keywordInput.blur();
  }
});

els.streamerBtn.addEventListener("click", openStreamerModal);
els.streamerModalClose.addEventListener("click", closeStreamerModal);
els.streamerModal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.hasAttribute("data-close-modal")) {
    closeStreamerModal();
  }
});

for (const button of els.streamerTabs) {
  button.addEventListener("click", () => setStreamerTab(button.dataset.streamerTab));
}

for (const button of els.viewerTabs) {
  button.addEventListener("click", () => setViewerTab(button.dataset.viewerTab));
}

els.streamerSignupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitStreamerForm("/api/auth/signup", els.streamerSignupForm);
});

els.streamerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitStreamerForm("/api/auth/login", els.streamerLoginForm);
});

els.streamerLogoutBtn.addEventListener("click", async () => {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast("Could not sign out");
    return;
  }

  renderStreamerState(null);
  showToast("Signed out");
});

async function verifyViewerKickAccount() {
  const slug = els.viewerKickUsernameInput.value.trim();
  if (!slug) {
    showToast("Enter your Kick username first");
    return;
  }

  const response = await fetch(`/api/kick/lookup?slug=${encodeURIComponent(slug)}`);
  const result = await response.json();

  if (!response.ok || !result.ok) {
    els.viewerChatroomField.classList.remove("hidden");
    showToast("Lookup failed — enter your chatroom ID manually");
    return;
  }

  els.viewerChatroomField.classList.add("hidden");
  els.viewerKickUsernameInput.value = result.channel.slug;
  showToast(`Kick account verified: ${result.channel.slug}`);
}

els.verifyViewerKickBtn.addEventListener("click", verifyViewerKickAccount);

els.viewerSignupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitViewerForm("/api/viewers/signup", els.viewerSignupForm);
});

els.viewerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitViewerForm("/api/viewers/login", els.viewerLoginForm);
});

els.viewerLogoutBtn.addEventListener("click", async () => {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast("Could not sign out");
    return;
  }

  renderViewerState(null);
  setViewerTab("signup");
  showToast("Signed out");
});

els.drawBtn.addEventListener("click", async () => {
  if (isSpinning || !isAdmin) {
    if (!isAdmin) {
      showToast("Streamer sign-in required");
      openStreamerModal();
    }
    return;
  }

  const eligible = dashboardState?.eligible ?? [];
  if (!eligible.length) {
    showToast("No eligible viewers to draw");
    return;
  }

  isSpinning = true;
  updateAdminControls();

  try {
    const count = Number(els.drawCount.value) || 1;
    const response = await fetch("/api/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const result = await response.json();

    if (!response.ok) {
      showToast(result.error ?? "Draw failed");
      return;
    }

    if (!result.winners?.length) {
      showToast("No winners drawn");
      return;
    }

    const usernames = eligible.map((entry) => entry.username);

    for (const winner of result.winners) {
      await spinWheel(usernames, winner.username);
      if (result.winners.length > 1) {
        await wait(800);
      }
    }

    if (result.state) {
      renderState(result.state);
    }

    showToast(`🏆 ${result.winners.map((winner) => winner.username).join(", ")} won!`);
  } catch {
    showToast("Draw failed");
  } finally {
    isSpinning = false;
    updateAdminControls();
  }
});

els.refreshBtn.addEventListener("click", async () => {
  if (isSpinning || !isAdmin) {
    if (!isAdmin) {
      showToast("Streamer sign-in required");
    }
    return;
  }

  const response = await fetch("/api/refresh", { method: "POST" });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast(result.error ?? "Could not clear winners");
    return;
  }

  if (result.state) {
    renderState(result.state);
  }

  showToast("Winners cleared");
});

socket.on("state", renderState);
socket.on("entry", (entry) => {
  showToast(`${entry.username}: ${statusLabel(entry)}`);
});
socket.on("winner", (winner) => {
  if (!isSpinning) {
    showToast(`🏆 ${winner.username} won!`);
  }
});
socket.on("chat_status", (status) => {
  if (status.error) {
    showToast(`Chat offline: ${status.error}`);
  }
});

fetch("/api/state")
  .then((response) => response.json())
  .then(renderState)
  .catch(() => showToast("Failed to load dashboard state"));

loadSession().catch(() => showToast("Failed to load account status"));

const kickOAuthStatus = new URLSearchParams(window.location.search).get("kick_oauth");
if (kickOAuthStatus === "linked") {
  showToast("Kick account linked — set a password to finish signup");
  setViewerTab("signup");
  history.replaceState({}, "", window.location.pathname);
} else if (kickOAuthStatus === "failed") {
  showToast("Kick account linking failed");
  history.replaceState({}, "", window.location.pathname);
}

setViewerTab("signup");
setStreamerTab("signup");
updateAdminControls();
