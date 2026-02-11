# EveryHour (Chrome Extension)

A private, lightweight check-in extension inspired by Victor Taelin's post.

## Features

- Sends reminders every **X minutes** (you choose X).
- Lets you choose a preferred **minute of the hour** (`0-59`) for schedule anchoring.
- After each check-in submission, the next reminder is scheduled for **X minutes later**.
- Popup composer supports:
  - **Enter** → send check-in
  - **Shift+Enter** → newline
- Stores all entries locally in `chrome.storage.local`.
- Options page can export JSON history and clear history.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder (`/workspace/everyhour`)

## Configure reminder timing

1. Open the extension's **Options** page.
2. Set **Reminder interval (X minutes)**.
3. Set **Preferred minute-of-hour** (`0-59`).
4. Click **Save Settings**.

## Notes

- This extension is for personal use and keeps data local-only.
- Uses a plain-text SVG icon asset (`icons/icon.svg`) to keep the repo fully text-based.
