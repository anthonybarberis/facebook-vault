# 📦 Vault — Facebook Archive Explorer

A local-first web app for exploring your Facebook data export. Browse your timeline, photos, messages, events, memories, and stats — all in a clean interface, entirely on your own computer. Nothing is uploaded anywhere.

**Live app:** [anthonybarberis.github.io/facebook-vault](https://anthonybarberis.github.io/facebook-vault/)

---

## Features

- **Timeline** — all your posts with photos, links, tags, locations, and feelings; full-text search, year filter, pagination
- **Albums** — every photo album from your exports, lightbox viewer
- **Messages** — all conversations (inbox, archived, filtered, E2E encrypted)
- **Events** — events you hosted, attended, or were invited to
**People** — your friends list over time
- **Activity** — comments you left and reactions you gave
- **Memories** — scrub through any day of the year and see what you posted on that date across all years
- **Stats** — charts for posting frequency, word clouds, reaction breakdowns, most-active periods

---

## Requirements

- **Chrome or Edge** (desktop). The app uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) to read your export folder directly without uploading it. Firefox and Safari do not support this API.
- Your Facebook data export in **JSON format** (not HTML — see below).

---

## Step 1 — Download Your Facebook Data

1. On Facebook, go to **Settings & Privacy → Settings → Your Facebook Information → Download Your Information** (or go directly to [facebook.com/dyi](https://www.facebook.com/dyi)).

2. Configure the download:
   - **Format:** `JSON` ← this is critical; the app cannot read HTML exports
   - **Date range:** All of my data (or whatever range you want)
   - **Media quality:** High (if you want full-resolution photos)

3. Under **Your information**, select the categories you want. For full functionality, include at least:
   - Posts
   - Photos and videos
   - Messages
   - Friends
   - Events
   - Comments
   - Reactions
   - Profile information
   - Pages you've liked

4. Click **Request a download**. Facebook will email you when it's ready — this can take anywhere from a few minutes to a few days depending on how much data you have.

5. Download the `.zip` file from the email link and **extract it**. You'll get a folder that looks something like this:

   ```
   facebook-yourname-json-2024.01/
   ├── posts/
   ├── messages/
   ├── photos_and_videos/
   ├── profile_information/
   ├── friends/
   ├── events/
   └── ...
   ```

   Newer exports (2025+) have a slightly different structure with a `your_facebook_activity/` folder instead, but the app handles both automatically.

> **Multiple exports:** If you have more than one export (e.g., one from an old account and one current), you can load both at the same time and the app will merge them into a single timeline.

---

## Step 2 — Open the App

Visit **[anthonybarberis.github.io/facebook-vault](https://anthonybarberis.github.io/facebook-vault/)** in Chrome or Edge.

---

## Step 3 — Load Your Data

1. Click **+ Add export folder**.
2. In the folder picker that appears, navigate to your **extracted export folder** (the top-level one that contains `posts/`, `messages/`, etc.) and click **Open** / **Select Folder**.
3. The app will detect the export format and show a green confirmation.
4. If you have a second export, click **+ Add export folder** again and repeat.
5. Click **Load →** to parse everything. This runs entirely in your browser — parsing a large export may take 10–30 seconds.

---

## Privacy

- **Nothing leaves your computer.** The app reads your files locally using the browser's File System Access API. No data is sent to any server.
- The GitHub Pages deployment serves only the app's HTML/JS/CSS — your export data never touches GitHub's servers.
- Photos are loaded directly from your local folder via the browser file handle — they are not copied or cached anywhere outside your browser session.

---

## Running Locally

If you'd prefer to run the app on your own machine (or contribute to development):

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/anthonybarberis/facebook-vault.git
cd facebook-vault
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in Chrome or Edge and follow the same setup steps above.

### Optional: Preprocessor

For faster loading, you can pre-process your export(s) into a single JSON file that the app loads instantly on startup:

```bash
node scripts/preprocess.mjs /path/to/export [/path/to/second-export]
```

This writes `public/vault-data.json` and symlinks your export folder so photos are served locally. On subsequent `npm run dev` sessions the app will skip the setup screen and load immediately.

> `vault-data.json` is gitignored — it contains your personal data and should never be committed.

---

## Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome 86+ | ✅ |
| Edge 86+ | ✅ |
| Firefox | ❌ (no File System Access API) |
| Safari | ❌ (no File System Access API) |
