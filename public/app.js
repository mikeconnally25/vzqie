const socket = io();

const els = {
  channel: document.getElementById("channel-name"),
  keyword: document.getElementById("entry-keyword"),
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

function renderState(state) {
  els.channel.textContent = state.channel;
  els.keyword.textContent = state.entryKeyword;
  els.statEligible.textContent = state.eligible.length;
  els.statEntries.textContent = state.recentEntries.length;
  els.statWinners.textContent = state.winners.length;

  els.connection.textContent = state.chatConnected ? "Live" : "Offline";
  els.connection.className = `pill ${state.chatConnected ? "pill-online" : "pill-offline"}`;

  renderList(
    els.entries,
    state.recentEntries,
    (entry) => `
      <article class="row">
        <div class="row-main">
          <div class="row-title">${entry.username}</div>
          <div class="row-meta">${entry.message}</div>
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
          <div class="row-title">${entry.username}</div>
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
          <div class="row-title">🏆 ${winner.username}</div>
          <div class="row-meta">${new Date(winner.timestamp).toLocaleString()}</div>
        </div>
      </article>
    `,
    "No winners yet"
  );
}

els.drawBtn.addEventListener("click", async () => {
  const count = Number(els.drawCount.value) || 1;
  const response = await fetch("/api/draw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });
  const result = await response.json();

  if (!result.winners?.length) {
    showToast("No winners drawn");
  } else {
    showToast(`Winner: ${result.winners.map((w) => w.username).join(", ")}`);
  }

  if (result.state) renderState(result.state);
});

socket.on("state", renderState);
socket.on("entry", (entry) => {
  showToast(`${entry.username} ${statusLabel(entry.status).toLowerCase()}`);
});
socket.on("winner", (winner) => {
  showToast(`🏆 ${winner.username} won!`);
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
