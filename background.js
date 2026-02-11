const ALARM_NAME = "everyhour-checkin";
const HISTORY_KEY = "checkinHistory";
const CURRENT_KEY = "currentTask";
const SETTINGS_KEY = "reminderSettings";

const DEFAULT_SETTINGS = {
  intervalMinutes: 60,
  minuteOffset: 0
};

function normalizeSettings(settings = {}) {
  const intervalRaw = Number(settings.intervalMinutes);
  const offsetRaw = Number(settings.minuteOffset);

  const intervalMinutes = Number.isFinite(intervalRaw)
    ? Math.min(720, Math.max(1, Math.round(intervalRaw)))
    : DEFAULT_SETTINGS.intervalMinutes;

  const minuteOffset = Number.isFinite(offsetRaw)
    ? Math.min(59, Math.max(0, Math.round(offsetRaw)))
    : DEFAULT_SETTINGS.minuteOffset;

  return { intervalMinutes, minuteOffset };
}

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}

function computeNextAlarmTime(now, settings) {
  const { intervalMinutes, minuteOffset } = normalizeSettings(settings);
  const anchor = new Date(now);
  anchor.setSeconds(0, 0);
  anchor.setMinutes(minuteOffset);

  if (anchor <= now) {
    anchor.setHours(anchor.getHours() + 1);
  }

  const next = new Date(anchor);
  while (next <= now) {
    next.setMinutes(next.getMinutes() + intervalMinutes);
  }

  return next.getTime();
}

async function scheduleFromSettings() {
  const settings = await getSettings();
  const nextWhen = computeNextAlarmTime(new Date(), settings);
  await chrome.alarms.create(ALARM_NAME, {
    when: nextWhen,
    periodInMinutes: settings.intervalMinutes
  });
}

async function scheduleFromNow() {
  const settings = await getSettings();
  const when = Date.now() + settings.intervalMinutes * 60 * 1000;
  await chrome.alarms.create(ALARM_NAME, {
    when,
    periodInMinutes: settings.intervalMinutes
  });
}

async function ensureDefaults() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  if (!data[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
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
    title: `Check-in · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    message,
    priority: 2
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await scheduleFromSettings();
  await notifyPrompt();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await scheduleFromSettings();
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
        historyCount: history.length,
        lastEntry: history[history.length - 1] || null,
        settings: normalizeSettings(data[SETTINGS_KEY])
      });
      return;
    }

    if (msg?.type === "clear-history") {
      await chrome.storage.local.set({ [HISTORY_KEY]: [] });
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "get-settings") {
      const settings = await getSettings();
      sendResponse({ ok: true, settings });
      return;
    }

    if (msg?.type === "save-settings") {
      const settings = normalizeSettings(msg.settings);
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
      await scheduleFromSettings();
      sendResponse({ ok: true, settings });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })();

  return true;
});
