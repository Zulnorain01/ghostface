# GhostFace Studio 🔪👻

Turn any photo into a cinematic **Ghostface horror portrait** — the "lurking behind you" format trending on TikTok/Reels. Static site, no backend, no sign-up.

**Live:** https://zulnorain01.github.io/ghostface/ · **Studio:** https://zulnorain01.github.io/ghostface/app/

## How it works

1. User uploads a photo (or picks a sample) in the Studio.
2. User picks a scene — *Lurking Behind You*, *Dark Hallway*, *Foggy Woods*, *Abandoned House* — or writes a custom direction.
3. The app calls the **Gemini API** (`gemini-2.5-flash-image`) with **the user's own free API key** and renders the horror portrait.
4. Download + one-tap "Copy TikTok caption + hashtags".

## API keys — read this

- **No API key is committed to this repo. Ever.** The app only works with a key the user pastes into Settings.
- Keys are stored in the browser's `localStorage` (`ghostface_api_key`) and sent only to `generativelanguage.googleapis.com`.
- Get a free key: https://aistudio.google.com/app/apikey (≈50 image generations/day on the free tier).

## Pro licenses

- Free export: 1024px with baked-in watermark (corner pill, diagonal marks, center line — burned into the PNG pixels).
- Pro ($4.99 one-time): watermark-free 2048px export.
- Keys look like `GF-XXXX-XXXX-XXXX`. Generate with:

```bash
node tools/gen-key.mjs [count]
```

- Keys are validated locally **on every export** (`validateKey()` in `app/app.js`). Client-side gating stops casual sharing, not devtools — server-side validation would be needed for bulletproof enforcement.
- Paste the real checkout URL into `PAYMENT_URL` in `app/config.js`.

## Project layout

```
index.html          landing page
styles.css          landing styles
app/                the Studio
  index.html        app shell (3-step wizard)
  app.js            all logic (upload → Gemini API → watermarked export)
  config.js         PAYMENT_URL + PRO_PRICE (edit me)
  styles.css        app styles
  sw.js             offline app-shell cache
  assets/           sample portraits (AI-generated)
  vendor/fonts/     Plus Jakarta Sans (vendored, offline-safe)
assets/             landing images (hero + scene gallery)
tools/gen-key.mjs   Pro license key generator
```

## Deploy

Plain static files — any static host works. GitHub Pages is enabled on `main` (root = `/`, app = `/app/`).

## Local dev

```bash
cd ghostface && python3 -m http.server 8080
# → http://localhost:8080/ and http://localhost:8080/app/
```
