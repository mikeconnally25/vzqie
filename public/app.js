const socket = io();

const els = {
  keywordEnabled: document.getElementById("keyword-enabled"),
  keywordInput: document.getElementById("keyword-input"),
  accountPill: document.getElementById("account-pill"),
  accountForms: document.getElementById("account-forms"),
  accountSignedIn: document.getElementById("account-signed-in"),
  signedInUsername: document.getElementById("signed-in-username"),
  signedInKick: document.getElementById("signed-in-kick"),
  kickUsernameInput: document.getElementById("kick-username-input"),
  verifyKickBtn: document.getElementById("verify-kick-btn"),
  signupForm: document.getElementById("signup-form"),
  loginForm: document.getElementById("login-form"),
  logoutBtn: document.getElementById("logout-btn"),
  authTabs: document.querySelectorAll(".auth-tab"),
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

async function loadCurrentUser() {
  const response = await fetch("/api/auth/me");
  const result = await response.json();
  renderAuthState(result.user);
}

function renderAuthState(user) {
  if (user) {
    els.accountPill.textContent = user.username;
    els.accountPill.classList.remove("hidden");
    els.signedInUsername.textContent = user.username;
    els.signedInKick.textContent = `${user.kickUsername} (${user.kickChatroomId})`;
    els.accountSignedIn.classList.remove("hidden");
    els.accountForms.classList.add("hidden");
    return;
  }

  els.accountPill.classList.add("hidden");
  els.accountSignedIn.classList.add("hidden");
  els.accountForms.classList.remove("hidden");
}

function setAuthTab(tab) {
  for (const button of els.authTabs) {
    button.classList.toggle("active", button.dataset.tab === tab);
  }

  els.signupForm.classList.toggle("hidden", tab !== "signup");
  els.loginForm.classList.toggle("hidden", tab !== "login");
}

async function submitAuthForm(url, form) {
  const data = new FormData(form);
  const body = Object.fromEntries(data.entries());

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast(result.error ?? "Account request failed");
    return;
  }

  form.reset();
  renderAuthState(result.user);
  showToast(`Welcome, ${result.user.username}`);
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
  syncKeywordControls(state);
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

for (const button of els.authTabs) {
  button.addEventListener("click", () => setAuthTab(button.dataset.tab));
}

async function verifyKickAccount() {
  const slug = els.kickUsernameInput.value.trim();
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

  els.kickUsernameInput.value = result.channel.slug;
  showToast(`Kick account verified: ${result.channel.slug}`);
}

els.verifyKickBtn.addEventListener("click", verifyKickAccount);

els.signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitAuthForm("/api/auth/signup", els.signupForm);
});

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitAuthForm("/api/auth/login", els.loginForm);
});

els.logoutBtn.addEventListener("click", async () => {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    showToast("Could not sign out");
    return;
  }

  renderAuthState(null);
  setAuthTab("login");
  showToast("Signed out");
});

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

loadCurrentUser().catch(() => showToast("Failed to load account status"));
setAuthTab("signup");
