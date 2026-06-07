const WHEEL_SPIN_MS = 5200;
const WINNERS_REVEAL_DELAY_MS = 3000;

const socket = io();

const els = {
  siteTitle: document.getElementById("site-title"),
  keywordEnabled: document.getElementById("keyword-enabled"),
  keywordInput: document.getElementById("keyword-input"),
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
  approval: document.getElementById("approval-list"),
  winners: document.getElementById("winners-list"),
  winnersPanel: document.getElementById("winners-panel"),
  toast: document.getElementById("toast"),
};

let dashboardState = null;
let isSpinning = false;
let suppressWinnersPanel = false;
let keywordSaveTimer;

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
    pending_approval: "Pending approval",
    rejected: "Rejected",
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

function updateDrawControls() {
  els.drawBtn.disabled = isSpinning;
  els.refreshBtn.disabled = isSpinning;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setWinnersPanelVisible(visible) {
  els.winnersPanel.classList.toggle("hidden", !visible);
}

function renderWinnersList(winners) {
  renderList(
    els.winners,
    winners,
    (winner) => `
      <div class="row">
        <div class="row-main">
          <div class="row-title">${escapeHtml(winner.username)}</div>
          <div class="row-meta">Drawn ${formatTime(winner.timestamp)}</div>
        </div>
      </div>
    `,
    "No winners yet"
  );
}

function renderState(state) {
  dashboardState = state;

  els.siteTitle.textContent = state.channel
    ? `${state.channel} Giveaway`
    : "Kick Giveaway";

  els.statEligible.textContent = String(state.eligible.length);
  els.statEntries.textContent = String(state.recentEntries.length);
  els.statWinners.textContent = String(state.winners.length);

  if (document.activeElement !== els.keywordInput) {
    els.keywordInput.value = state.entryKeyword;
  }
  if (document.activeElement !== els.keywordEnabled) {
    els.keywordEnabled.checked = state.keywordEnabled;
  }
  els.keywordInput.disabled = !state.keywordEnabled;

  renderList(
    els.entries,
    state.recentEntries,
    (entry) => `
      <div class="row">
        <div class="row-main">
          <div class="row-title">${escapeHtml(entry.username)} ${riskBadge(entry.riskLevel)}</div>
          <div class="row-meta">${escapeHtml(entry.message)} · <span class="status-${entry.status}">${escapeHtml(statusLabel(entry))}</span></div>
        </div>
        <div class="row-meta">${formatTime(entry.timestamp)}</div>
      </div>
    `,
    "Waiting for chat entries…"
  );

  renderList(
    els.eligible,
    state.eligible,
    (participant) => `
      <div class="row">
        <div class="row-main">
          <div class="row-title">${escapeHtml(participant.username)} ${riskBadge(participant.riskLevel)}</div>
          <div class="row-meta">Entered ${formatTime(participant.timestamp)}</div>
        </div>
      </div>
    `,
    "No eligible viewers yet"
  );

  renderList(
    els.approval,
    state.pendingApproval,
    (entry) => `
      <div class="row">
        <div class="row-main">
          <div class="row-title">${escapeHtml(entry.username)} ${riskBadge(entry.riskLevel)}</div>
          <div class="row-meta">Risk score ${entry.riskScore}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-approve="${escapeHtml(entry.username)}">Approve</button>
          <button class="btn btn-danger btn-sm" type="button" data-reject="${escapeHtml(entry.username)}">Reject</button>
        </div>
      </div>
    `,
    "No pending approvals"
  );

  if (suppressWinnersPanel) {
    setWinnersPanelVisible(false);
  } else {
    renderWinnersList(state.winners);
    setWinnersPanelVisible(true);
  }

  renderWheelIdle(state.eligible);
}

function setConnectionStatus(connected, error) {
  els.connection.className = connected ? "pill pill-online" : "pill pill-offline";
  els.connection.textContent = connected ? "Live" : error ? "Offline" : "Offline";
  els.connection.title = error ?? "";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

async function saveKeywordSettings() {
  try {
    const { state } = await api("/api/settings/keyword", {
      method: "PATCH",
      body: JSON.stringify({
        keyword: els.keywordInput.value,
        enabled: els.keywordEnabled.checked,
      }),
    });
    renderState(state);
  } catch (error) {
    showToast(error.message);
  }
}

async function handleDraw() {
  if (isSpinning) {
    return;
  }

  const count = Number(els.drawCount.value || 1);

  try {
    isSpinning = true;
    updateDrawControls();

    const { winners, state } = await api("/api/draw", {
      method: "POST",
      body: JSON.stringify({ count }),
    });

    if (!winners.length) {
      showToast("No eligible participants to draw.");
      renderState(state);
      return;
    }

    suppressWinnersPanel = true;
    setWinnersPanelVisible(false);

    const usernames = state.eligible.map((participant) => participant.username);
    for (const winner of winners) {
      await spinWheel(usernames, winner.username);
    }

    await wait(WINNERS_REVEAL_DELAY_MS);

    suppressWinnersPanel = false;
    renderState(state);
  } catch (error) {
    showToast(error.message);
    suppressWinnersPanel = false;
    if (dashboardState) {
      renderState(dashboardState);
    } else {
      setWinnersPanelVisible(true);
    }
  } finally {
    isSpinning = false;
    updateDrawControls();
  }
}

els.drawBtn.addEventListener("click", handleDraw);

els.refreshBtn.addEventListener("click", async () => {
  try {
    const { state } = await api("/api/refresh", { method: "POST" });
    renderState(state);
    showToast("Winner history cleared.");
  } catch (error) {
    showToast(error.message);
  }
});

els.approval.addEventListener("click", async (event) => {
  const approveBtn = event.target.closest("[data-approve]");
  const rejectBtn = event.target.closest("[data-reject]");

  if (approveBtn) {
    try {
      const { state } = await api("/api/approve", {
        method: "POST",
        body: JSON.stringify({ username: approveBtn.dataset.approve }),
      });
      renderState(state);
      showToast(`Approved ${approveBtn.dataset.approve}`);
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (rejectBtn) {
    try {
      const { state } = await api("/api/reject", {
        method: "POST",
        body: JSON.stringify({ username: rejectBtn.dataset.reject }),
      });
      renderState(state);
      showToast(`Rejected ${rejectBtn.dataset.reject}`);
    } catch (error) {
      showToast(error.message);
    }
  }
});

els.keywordEnabled.addEventListener("change", () => {
  els.keywordInput.disabled = !els.keywordEnabled.checked;
  clearTimeout(keywordSaveTimer);
  keywordSaveTimer = setTimeout(saveKeywordSettings, 300);
});

els.keywordInput.addEventListener("input", () => {
  clearTimeout(keywordSaveTimer);
  keywordSaveTimer = setTimeout(saveKeywordSettings, 500);
});

socket.on("state", renderState);
socket.on("entry", () => {
  /* state broadcast follows */
});
socket.on("winner", () => {
  /* state broadcast follows */
});
socket.on("chat_status", (payload) => {
  setConnectionStatus(payload.connected, payload.error);
});

fetch("/api/state")
  .then((response) => response.json())
  .then((state) => {
    renderState(state);
    setConnectionStatus(state.chatConnected);
  })
  .catch(() => {
    showToast("Could not load dashboard state.");
  });

updateDrawControls();
