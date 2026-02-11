const HISTORY_KEY = "checkinHistory";
const intervalInput = document.getElementById("intervalMinutes");
const offsetInput = document.getElementById("minuteOffset");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

async function loadSettings() {
  const res = await chrome.runtime.sendMessage({ type: "get-settings" });
  if (!res?.ok) {
    statusEl.textContent = "Could not load settings.";
    return;
  }

  intervalInput.value = String(res.settings.intervalMinutes);
  offsetInput.value = String(res.settings.minuteOffset);
}

async function saveSettings() {
  const settings = {
    intervalMinutes: toInt(intervalInput.value, 60),
    minuteOffset: toInt(offsetInput.value, 0)
  };

  const res = await chrome.runtime.sendMessage({ type: "save-settings", settings });
  if (!res?.ok) {
    statusEl.textContent = "Failed to save settings.";
    return;
  }

  intervalInput.value = String(res.settings.intervalMinutes);
  offsetInput.value = String(res.settings.minuteOffset);
  statusEl.textContent = `Saved. Every ${res.settings.intervalMinutes} min, minute offset ${res.settings.minuteOffset}.`;
}

async function loadHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const history = data[HISTORY_KEY] || [];
  previewEl.textContent = JSON.stringify(history.slice(-20), null, 2);
  return history;
}

document.getElementById("saveSettings").addEventListener("click", saveSettings);

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
