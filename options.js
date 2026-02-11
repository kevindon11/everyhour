const HISTORY_KEY = "checkinHistory";
const SETTINGS_KEY = "reminderSettings";
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const intervalInput = document.getElementById("intervalInput");
const minuteOffsetInput = document.getElementById("minuteOffsetInput");
const timingStatusEl = document.getElementById("timingStatus");

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

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const history = data[HISTORY_KEY] || [];
  previewEl.textContent = JSON.stringify(history.slice(-20), null, 2);
  return history;
}

async function loadSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = clampSettings(data[SETTINGS_KEY]);
  intervalInput.value = settings.intervalMinutes;
  minuteOffsetInput.value = settings.minuteOffset;
}

async function saveSettings() {
  const settings = clampSettings({
    intervalMinutes: intervalInput.value,
    minuteOffset: minuteOffsetInput.value
  });

  intervalInput.value = settings.intervalMinutes;
  minuteOffsetInput.value = settings.minuteOffset;

  const res = await chrome.runtime.sendMessage({ type: "save-settings", settings });
  timingStatusEl.textContent = res?.ok ? "Timing saved." : "Failed to save timing.";
}

document.getElementById("saveTiming").addEventListener("click", saveSettings);

document.getElementById("exportJson").addEventListener("click", async () => {
  const history = await loadHistory();
  const filename = `everyhour-checkins-${new Date().toISOString().slice(0, 10)}.json`;
  download(filename, JSON.stringify(history, null, 2), "application/json");
  statusEl.textContent = `Exported ${history.length} entries.`;
});

document.getElementById("clearHistory").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "clear-history" });
  await loadHistory();
  statusEl.textContent = "History cleared.";
});

loadSettings();
loadHistory();
