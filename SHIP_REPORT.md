# GhostFace Studio — SHIP REPORT (2026-09-23)

## Links
- Repo: https://github.com/Zulnorain01/ghostface (public, branch `main`)
- Landing: https://zulnorain01.github.io/ghostface/
- App: https://zulnorain01.github.io/ghostface/app/
- GitHub Pages: enabled on `main` / root, build status `built`, all three probes (landing, /app/, hero image) return HTTP 200.

## What was built
Static HTML/CSS/JS horror-photo studio (no backend, no build step), styled to match the SplitFace/CareerOS dark-modern look, fully responsive (verified 1440px + 390px, zero horizontal overflow).

- **Landing** (`index.html`): hero with interactive before/after drag slider (mouse, touch, keyboard, ARIA), ticker, how-it-works, 4-scene gallery (each card deep-links into the app with `?scene=`), pricing (Free vs Pro $4.99 one-time), FAQ, final CTA.
- **App** (`app/`): 3-step flow — 1) upload photo or pick 1 of 3 built-in samples, 2) pick a scene (Lurking Behind You / Dark Hallway / Foggy Woods / Abandoned House) + optional custom prompt, 3) generate → result.
- **Generation**: calls Gemini `gemini-2.5-flash-image` with the *visitor's own* free API key (entered once, stored only in their browser localStorage). No key is bundled in the repo. Free tier ≈ 50 images/day.
- **Free export**: 1024px PNG with watermark baked into the pixels (corner pill, 2 diagonal marks, center line).
- **Pro ($4.99 one-time)**: license keys `GF-XXXX-XXXX-XXXX` (generate with `node tools/gen-key.mjs`), validated locally on **every** export, no URL backdoor. Unlocks watermark-free 2048px exports. Client-side gating deters casual sharing, not a determined user — noted in code comments.
- **Extras**: one-tap TikTok caption + hashtag copy, "Go Pro" button → `PAYMENT_URL` in `app/config.js`, offline service worker for the app shell.

## Imagery (this session)
- AI-generated, committed + pushed: `assets/scene-hallway.jpg`, `assets/scene-woods.jpg`, `assets/scene-house.jpg` (photorealistic, no text/watermarks — verified visually).
- `assets/hero-after.jpg`: the image generation for the true hero shot failed this turn, so this file is currently a **copy of scene-house.jpg as a stand-in** — the slider and gallery work with no 404s. A later run can generate the real "Ghostface lurking behind a person" portrait and overwrite this one file.
- Verified: no API key or secret committed anywhere (only an `AIza…` input placeholder, which is inert).

## QA results — 36/36 PASS (2026-09-23)
Full Playwright pass (headless shell, local 127.0.0.1 server), **Gemini API fully mocked — zero real API calls**:
- Landing + app: zero console/page errors, zero failed requests (the 5 earlier 404s are gone), zero horizontal overflow at 1440px and 390px.
- Flow: sample upload → scene select → generate (mocked) → result; request verified as POST with `x-goog-api-key` header, TEXT+IMAGE modalities, Ghostface + scene prompt.
- Free export: `ghostface-studio-free.png`, max side 1024px, watermark pixels confirmed present.
- Pro: real generated key unlocks via UI, badge flips to PRO, `ghostface-studio-pro.png` at 2048px with no watermark pixels.
- Bad/short/empty keys rejected; tampered stored key falls back to free export (re-validated per export).
- Generate without an API key opens the key-settings modal and makes no API call.
- Screenshots: landing + app at desktop and mobile (in /tmp/gf-qa, cleaned after run).

## Left for Muhammad
1. **Payment link**: replace `PAYMENT_URL` in `app/config.js` (currently a placeholder) with the real checkout URL (NOWPayments/Gumroad/Lemon Squeezy) for the $4.99 "GhostFace Studio Pro" product, then `git push` — Pages redeploys automatically.
2. **Real hero image** (optional polish): generate the true `assets/hero-after.jpg` ("Ghostface mask figure lurking behind a person, cinematic, portrait") and overwrite the stand-in.
3. **Sell**: share on TikTok/Reels + the trend; each export carries the watermark as free marketing.
4. License keys: run `node tools/gen-key.mjs 5` and hand one key per paying customer (never commit keys).
