const taskInput = document.getElementById("taskInput");
const submitBtn = document.getElementById("submitBtn");
const sameBtn = document.getElementById("sameBtn");
const statusEl = document.getElementById("status");
const logListEl = document.getElementById("logList");
const timelineRowsEl = document.getElementById("timelineRows");
const workedTodayEl = document.getElementById("workedToday");
const intervalInput = document.getElementById("intervalInput");
const minuteOffsetInput = document.getElementById("minuteOffsetInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatusEl = document.getElementById("settingsStatus");

const hasChromeApi = typeof chrome !== "undefined" && !!chrome.runtime?.id;

function clampSettings(raw = {}) {
  const intervalRaw = Number(raw.intervalMinutes);
  const minuteOffsetRaw = Number(raw.minuteOffset);

  const intervalMinutes = Number.isFinite(intervalRaw)
    ? Math.min(180, Math.max(1, Math.round(intervalRaw)))
    : 60;

  const minuteOffset = Number.isFinite(minuteOffsetRaw)
    ? Math.min(59, Math.max(0, Math.round(minuteOffsetRaw)))
    : 0;

  return { intervalMinutes, minuteOffset };
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#a12626" : "#2f8a47";
}

function setSettingsStatus(text, isError = false) {
  settingsStatusEl.textContent = text;
  settingsStatusEl.style.color = isError ? "#a12626" : "#2f8a47";
}

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

function renderLogs(history) {
  logListEl.innerHTML = "";
  const reversed = [...history].reverse().slice(0, 40);
  for (const entry of reversed) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="logTime">${formatTime(entry.timestamp)}</span><br>${entry.unchanged ? "(unchanged)" : entry.task || "(blank)"}`;
    logListEl.appendChild(li);
  }
}

function renderTimeline(history) {
  const byDay = new Map();
  history.forEach((entry) => {
    const d = new Date(entry.timestamp);
    const day = d.toISOString().slice(0, 10);
    const hour = d.getHours();
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(hour);
  });

  timelineRowsEl.innerHTML = "";
  const days = [...byDay.keys()].sort().slice(-7).reverse();
  for (const day of days) {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("div");
    label.textContent = day;
    const blocks = document.createElement("div");
    blocks.className = "blocks";
    for (let h = 0; h < 24; h += 1) {
      const b = document.createElement("div");
      b.className = `block ${byDay.get(day).has(h) ? "active" : ""}`;
      blocks.appendChild(b);
    }
    row.append(label, blocks);
    timelineRowsEl.appendChild(row);
  }
}

function updateTodayHours(history) {
  const today = new Date().toISOString().slice(0, 10);
  const hours = new Set(
    history
      .filter((h) => h.timestamp.startsWith(today))
      .map((h) => new Date(h.timestamp).getHours())
  );
  workedTodayEl.textContent = `Today: ${hours.size}h`;
}

async function getState() {
  if (!hasChromeApi) {
    const now = Date.now();
    return {
      ok: true,
      settings: { intervalMinutes: 60, minuteOffset: 0 },
      history: [
        { timestamp: new Date(now - 3600_000).toISOString(), task: "initial prototype", unchanged: false },
        { timestamp: new Date(now).toISOString(), task: "extension UI pass", unchanged: false }
      ]
    };
  }

  const state = await chrome.runtime.sendMessage({ type: "get-state" });
  if (!state?.ok) return { ok: false };

  const data = await chrome.storage.local.get(["checkinHistory"]);
  return {
    ok: true,
    history: data.checkinHistory || [],
    currentTask: state.currentTask || "",
    settings: clampSettings(state.settings)
  };
}

function renderSettings(settings) {
  intervalInput.value = settings.intervalMinutes;
  minuteOffsetInput.value = settings.minuteOffset;
}

async function refresh() {
  const res = await getState();
  if (!res.ok) return setStatus("Failed loading history", true);
  renderLogs(res.history);
  renderTimeline(res.history);
  updateTodayHours(res.history);
  if (res.currentTask) taskInput.value = res.currentTask;
  renderSettings(res.settings || clampSettings());
}

async function submit(unchanged) {
  const task = taskInput.value.trim();

  if (!hasChromeApi) {
    setStatus("Preview mode only (load extension in Chrome).", true);
    return;
  }

  if (!unchanged && !task) {
    setStatus("Type a task or use Still same.", true);
    return;
  }

  const res = await chrome.runtime.sendMessage({ type: "submit-checkin", task, unchanged });
  if (!res?.ok) return setStatus("Save failed.", true);
  setStatus("Saved. Next popup set from now.");
  await refresh();
}

async function saveSettings() {
  const settings = clampSettings({
    intervalMinutes: intervalInput.value,
    minuteOffset: minuteOffsetInput.value
  });

  intervalInput.value = settings.intervalMinutes;
  minuteOffsetInput.value = settings.minuteOffset;

  if (!hasChromeApi) {
    setSettingsStatus("Preview mode only (load extension in Chrome).", true);
    return;
  }

  const res = await chrome.runtime.sendMessage({ type: "save-settings", settings });
  if (!res?.ok) {
    setSettingsStatus("Failed to save settings.", true);
    return;
  }

  setSettingsStatus("Timing updated.");
}

submitBtn.addEventListener("click", () => submit(false));
sameBtn.addEventListener("click", () => submit(true));
saveSettingsBtn.addEventListener("click", saveSettings);

taskInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (event.shiftKey) return;

  event.preventDefault();
  submit(false);
});

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("logsPanel").classList.toggle("active", tab === "logs");
    document.getElementById("timelinePanel").classList.toggle("active", tab === "timeline");
    document.getElementById("settingsPanel").classList.toggle("active", tab === "settings");
  });
});

refresh().catch(() => setStatus("Unexpected error.", true));
