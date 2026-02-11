const HISTORY_KEY = "checkinHistory";
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

async function loadHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const history = data[HISTORY_KEY] || [];
  previewEl.textContent = JSON.stringify(history.slice(-20), null, 2);
  return history;
}

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

loadHistory();
