const socket = io();

const WHEEL_ITEM_WIDTH = 166;
const WHEEL_SPIN_MS = 5200;

const els = {
  keywordEnabled: document.getElementById("keyword-enabled"),
  keywordInput: document.getElementById("keyword-input"),
  accountPill: document.getElementById("account-pill"),
  viewerForms: document.getElementById("viewer-forms"),
  viewerSignedIn: document.getElementById("viewer-signed-in"),
  signedInViewerKick: document.getElementById("signed-in-viewer-kick"),
  viewerKickUsernameInput: document.getElementById("viewer-kick-username-input"),
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

function statusLabel(status) {
  return {
    entered: "Entered",
    blocked: "Blocked",
  }[status] ?? status;
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

  const offset =
    winnerIndex * WHEEL_ITEM_WIDTH -
    els.wheelViewport.offsetWidth / 2 +
    WHEEL_ITEM_WIDTH / 2;

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

async function loadCurrentUser() {
  const response = await fetch("/api/auth/me");
  const result = await response.json();
  renderViewerState(result.viewer);
}

function renderViewerState(viewer) {
  if (viewer) {
    els.accountPill.textContent = viewer.kickUsername;
    els.accountPill.classList.remove("hidden");
    els.signedInViewerKick.textContent = `${viewer.kickUsername} (${viewer.kickChatroomId})`;
    els.viewerSignedIn.classList.remove("hidden");
    els.viewerForms.classList.add("hidden");
    return;
  }

  els.accountPill.classList.add("hidden");
  els.viewerSignedIn.classList.add("hidden");
  els.viewerForms.classList.remove("hidden");
}

function setViewerTab(tab) {
  for (const button of els.viewerTabs) {
    button.classList.toggle("active", button.dataset.viewerTab === tab);
  }

  els.viewerSignupForm.classList.toggle("hidden", tab !== "signup");
  els.viewerLoginForm.classList.toggle("hidden", tab !== "login");
}

async function submitViewerForm(url, form) {
  const data = new FormData(form);
  const body = Object.fromEntries(data.entries());

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

  els.keywordInput.disabled = !state.keywordEnabled;
}

function renderState(state) {
  dashboardState = state;
  syncKeywordControls(state);
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
          <span class="status-${entry.status}">${statusLabel(entry.status)}</span>
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

for (const button of els.viewerTabs) {
  button.addEventListener("click", () => setViewerTab(button.dataset.viewerTab));
}

async function verifyViewerKickAccount() {
  const slug = els.viewerKickUsernameInput.value.trim();
  if (!slug) {
    showToast("Enter your Kick username first");
    return;
  }

  const response = await fetch(`/api/kick/lookup?slug=${encodeURIComponent(slug)}`);
  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast(result.error ?? "Could not verify Kick account");
    return;
  }

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
  if (isSpinning) {
    return;
  }

  const eligible = dashboardState?.eligible ?? [];
  if (!eligible.length) {
    showToast("No eligible viewers to draw");
    return;
  }

  isSpinning = true;
  els.drawBtn.disabled = true;

  try {
    const count = Number(els.drawCount.value) || 1;
    const response = await fetch("/api/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const result = await response.json();

    if (!result.winners?.length) {
      showToast("No winners drawn");
      return;
    }

    const winner = result.winners[0];
    const usernames = eligible.map((entry) => entry.username);

    await spinWheel(usernames, winner.username);

    if (result.state) {
      renderState(result.state);
    }

    showToast(`🏆 ${winner.username} won!`);
  } catch {
    showToast("Draw failed");
  } finally {
    isSpinning = false;
    els.drawBtn.disabled = false;
  }
});

socket.on("state", renderState);
socket.on("entry", (entry) => {
  showToast(`${entry.username} ${statusLabel(entry.status).toLowerCase()}`);
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

loadCurrentUser().catch(() => showToast("Failed to load account status"));
setViewerTab("signup");
