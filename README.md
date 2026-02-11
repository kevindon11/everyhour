# EveryHour (Chrome Extension)

A private, lightweight hourly check-in extension inspired by Victor Taelin's post:

- Every hour, Chrome sends a notification asking what you're working on.
- You can log a short task update from the popup.
- If nothing changed, click **Still same task**.
- All entries are stored locally in your browser.
- Use the options page to export JSON history.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder (`/workspace/everyhour`)

## Notes

- This extension is for personal use and keeps data in `chrome.storage.local`.
- Notification cadence is fixed at every 60 minutes.
- If you want cloud sync later, switch storage calls to `chrome.storage.sync`.

- Uses a plain-text SVG icon asset (`icons/icon.svg`) to keep the repo fully text-based.
