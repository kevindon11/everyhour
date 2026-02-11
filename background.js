const ALARM_NAME = "everyhour-checkin";
const HISTORY_KEY = "checkinHistory";
const CURRENT_KEY = "currentTask";

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    await chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: 60,
      delayInMinutes: 1
    });
  }
}

async function pushHistoryEntry(entry) {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = stored[HISTORY_KEY] || [];
  history.push(entry);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

async function notifyPrompt() {
  const now = new Date();
  const taskData = await chrome.storage.local.get(CURRENT_KEY);
  const currentTask = taskData[CURRENT_KEY] || "";
  const message = currentTask
    ? `Current: ${currentTask} — update if changed.`
    : "What are you working on right now?";

  await chrome.notifications.create(`checkin-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon.svg",
    title: `Hourly check-in · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    message,
    priority: 2
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarm();
  await notifyPrompt();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await notifyPrompt();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "submit-checkin") {
      const nowIso = new Date().toISOString();
      const entry = {
        timestamp: nowIso,
        task: msg.task?.trim() || "",
        unchanged: Boolean(msg.unchanged)
      };

      if (entry.task) {
        await chrome.storage.local.set({ [CURRENT_KEY]: entry.task });
      }

      await pushHistoryEntry(entry);
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "get-state") {
      const data = await chrome.storage.local.get([CURRENT_KEY, HISTORY_KEY]);
      const history = data[HISTORY_KEY] || [];
      sendResponse({
        ok: true,
        currentTask: data[CURRENT_KEY] || "",
        historyCount: history.length,
        lastEntry: history[history.length - 1] || null
      });
      return;
    }

    if (msg?.type === "clear-history") {
      await chrome.storage.local.set({ [HISTORY_KEY]: [] });
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })();

  return true;
});
