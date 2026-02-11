const ALARM_NAME = "everyhour-checkin";
const HISTORY_KEY = "checkinHistory";
const CURRENT_KEY = "currentTask";
const SETTINGS_KEY = "reminderSettings";

const DEFAULT_SETTINGS = {
  intervalMinutes: 60,
  minuteOffset: 0
};

function clampSettings(raw = {}) {
  const intervalRaw = Number(raw.intervalMinutes);
  const minuteOffsetRaw = Number(raw.minuteOffset);

  const intervalMinutes = Number.isFinite(intervalRaw)
    ? Math.min(180, Math.max(1, Math.round(intervalRaw)))
    : DEFAULT_SETTINGS.intervalMinutes;

  const minuteOffset = Number.isFinite(minuteOffsetRaw)
    ? Math.min(59, Math.max(0, Math.round(minuteOffsetRaw)))
    : DEFAULT_SETTINGS.minuteOffset;

  return { intervalMinutes, minuteOffset };
}

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return clampSettings(data[SETTINGS_KEY]);
}

function computeAlignedDelayInMinutes(intervalMinutes, minuteOffset, fromDate = new Date()) {
  const currentMinute = Math.floor(fromDate.getTime() / 60_000);
  let nextMinute = currentMinute + 1;

  while ((nextMinute - minuteOffset) % intervalMinutes !== 0) {
    nextMinute += 1;
  }

  return nextMinute - currentMinute;
}

async function ensureAlarm() {
  const settings = await getSettings();
  const existing = await chrome.alarms.get(ALARM_NAME);
  const alignedDelay = computeAlignedDelayInMinutes(settings.intervalMinutes, settings.minuteOffset);

  const shouldRecreate =
    !existing
    || existing.periodInMinutes !== settings.intervalMinutes
    || Math.abs((existing.scheduledTime || 0) - Date.now() - (alignedDelay * 60_000)) > 65_000;

  if (shouldRecreate) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: settings.intervalMinutes,
      delayInMinutes: alignedDelay
    });
  }
}

async function scheduleFromNow() {
  const settings = await getSettings();
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: settings.intervalMinutes,
    delayInMinutes: settings.intervalMinutes
  });
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
    title: `Check-in · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
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
      await scheduleFromNow();
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "get-state") {
      const data = await chrome.storage.local.get([CURRENT_KEY, HISTORY_KEY, SETTINGS_KEY]);
      const history = data[HISTORY_KEY] || [];
      sendResponse({
        ok: true,
        currentTask: data[CURRENT_KEY] || "",
        settings: clampSettings(data[SETTINGS_KEY]),
        historyCount: history.length,
        lastEntry: history[history.length - 1] || null
      });
      return;
    }

    if (msg?.type === "save-settings") {
      const settings = clampSettings(msg.settings);
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
      await ensureAlarm();
      sendResponse({ ok: true, settings });
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
