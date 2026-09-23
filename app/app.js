/* ============================================================
   GhostFace Studio — app logic
   Static client-side app. Image generation calls the Gemini API
   with the USER'S OWN key (stored in localStorage only).
   NEVER hardcode an API key in this repo.

   Pro unlock: license keys GF-XXXX-XXXX-XXXX, validated locally
   on EVERY export (re-checked each time, never a URL flag).
   Generate keys with:  node tools/gen-key.mjs
   NOTE: client-side gating stops casual sharing, not a
   determined devtools user. Server-side validation would be
   needed for bulletproof enforcement.
   ============================================================ */
'use strict';

const CFG = window.GHOSTFACE_CONFIG || {};
const PRO_PRICE = CFG.PRO_PRICE || '$4.99 one-time';
const PAYMENT_URL = CFG.PAYMENT_URL || 'https://www.example.com/ghostface-pro-checkout';

const API_MODEL = 'gemini-2.5-flash-image';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + API_MODEL + ':generateContent';

const LS_API_KEY = 'ghostface_api_key';
const LS_PRO_KEY = 'ghostface_key';

const FREE_MAX_SIDE = 1024;
const PRO_MAX_SIDE = 2048;
const UPLOAD_MAX_SIDE = 1024; // downscale before sending to the API

/* ---------------- Pro license keys ---------------- */
const KEY_SALT = 'ghostface-pro-v1';
const KEY_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function keyChecksum(body) {
  let h = 0;
  const s = body + KEY_SALT;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  let code = '', x = h;
  for (let i = 0; i < 4; i++) { code += KEY_ALPHA[x % KEY_ALPHA.length]; x = Math.floor(x / KEY_ALPHA.length); }
  return code;
}
function validateKey(key) {
  if (!key) return false;
  let clean = String(key).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.startsWith('GF')) clean = clean.slice(2); // drop the "GF-" display prefix
  if (clean.length !== 12) return false;
  return clean.slice(8) === keyChecksum(clean.slice(0, 8));
}
function isPro() {
  try { return validateKey(localStorage.getItem(LS_PRO_KEY) || ''); }
  catch (e) { return false; }
}

/* ---------------- scenes ---------------- */
const SCENES = {
  lurking: {
    name: 'Lurking Behind You',
    detail: 'looming directly behind the person, the white mask emerging from darkness just over their shoulder, slightly out of focus',
  },
  hallway: {
    name: 'Dark Hallway',
    detail: 'standing motionless at the far end of a long dark hallway behind the person, lit by a single flickering ceiling light',
  },
  woods: {
    name: 'Foggy Woods',
    detail: 'emerging from thick fog in dark moonlit woods behind the person, branches clawing at the edges of the frame',
  },
  house: {
    name: 'Abandoned House',
    detail: 'standing in the rotting doorway of a decaying abandoned house behind the person, dust drifting through a flashlight beam',
  },
};

function buildPrompt(sceneId, custom) {
  const scene = SCENES[sceneId] || SCENES.lurking;
  let p = 'Transform this photo into a cinematic horror portrait in the style of the viral TikTok Ghostface trend. ' +
    'A tall terrifying figure wearing the iconic white elongated screaming Ghostface mask ' + scene.detail + '. ' +
    'CRITICAL: keep the person\'s face, likeness, expression and pose from the original photo completely recognizable and unchanged — ' +
    'only transform the atmosphere, lighting and background around them. ' +
    'Dark foggy atmosphere, film grain, dramatic horror-movie lighting, photorealistic, vertical portrait.';
  if (custom && custom.trim()) p += ' Additional direction: ' + custom.trim().slice(0, 300);
  return p;
}

/* ---------------- TikTok captions ---------------- */
const CAPTIONS = [
  {
    text: 'POV: you finally check behind you 👻🔪',
    tags: '#ghostface #ghostfacetrend #halloween2026 #scarytiktok #aitrend #horrortok #spookyseason #fyp',
  },
  {
    text: 'He was standing there the whole time… 😱',
    tags: '#ghostface #horrormovie #halloween #ghostfacetrend #creepy #aitrend #scarystory #fyp',
  },
  {
    text: 'Do NOT watch this alone at 3am 🔪👻',
    tags: '#ghostface #3amchallenge #halloween2026 #ghostfacetrend #horrortok #spooky #aitrend #fyp',
  },
];

/* ---------------- state ---------------- */
const state = {
  photo: null,      // { img: HTMLImageElement, name: string }
  scene: 'lurking',
  result: null,     // dataURL of the generated portrait
  generating: false,
};

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const el = {
  keyPill: $('key-pill'), keyDot: $('key-dot'), keyPillLabel: $('key-pill-label'),
  dropzone: $('dropzone'), fileInput: $('file-input'),
  photoReady: $('photo-ready'), photoThumb: $('photo-thumb'), photoName: $('photo-name'),
  changePhoto: $('change-photo'), toStep2: $('to-step-2'),
  backTo1: $('back-to-1'), generateBtn: $('generate-btn'), customPrompt: $('custom-prompt'),
  openSettings2: $('open-settings-2'),
  generating: $('generating'), genStatus: $('gen-status'),
  result: $('result'), resultImg: $('result-img'), resultBadge: $('result-badge'),
  downloadBtn: $('download-btn'), captionBtn: $('caption-btn'),
  backTo2: $('back-to-2'), againBtn: $('again-btn'),
  proNudge: $('pro-nudge'), goproBtn: $('gopro-btn'),
  keyInput: $('key-input'), keyApply: $('key-apply'), keyMsg: $('key-msg'),
  genError: $('gen-error'), genErrorMsg: $('gen-error-msg'),
  genErrorDetail: $('gen-error-detail'), genErrorDetails: $('gen-error-details'),
  errorBack: $('error-back'), errorRetry: $('error-retry'),
  settingsModal: $('settings-modal'), settingsClose: $('settings-close'),
  apiKeyInput: $('api-key-input'), apiKeySave: $('api-key-save'),
  apiKeyClear: $('api-key-clear'), apiKeyMsg: $('api-key-msg'),
  apiKeyTest: $('api-key-test'),
  toast: $('toast'),
};

let toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3200);
}

/* ---------------- steps ---------------- */
function showStep(n) {
  [1, 2, 3].forEach((i) => { $('panel-' + i).hidden = i !== n; });
  document.querySelectorAll('.step').forEach((s) => {
    const sn = parseInt(s.dataset.step, 10);
    s.classList.toggle('is-active', sn === n);
    s.classList.toggle('is-done', sn < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------- API key (user's own) ---------------- */
function getApiKey() {
  try { return (localStorage.getItem(LS_API_KEY) || '').trim(); }
  catch (e) { return ''; }
}
function refreshKeyPill() {
  const has = !!getApiKey();
  el.keyPill.classList.toggle('has-key', has);
  el.keyPillLabel.textContent = has ? 'API key set' : 'No API key';
}
function openSettings(notice) {
  el.apiKeyInput.value = '';
  el.apiKeyMsg.textContent = notice || '';
  el.apiKeyMsg.className = 'fineprint';
  el.settingsModal.hidden = false;
  setTimeout(() => el.apiKeyInput.focus(), 50);
}
function closeSettings() { el.settingsModal.hidden = true; }

/* ---------------- photo intake ---------------- */
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('That file is not an image — please choose a JPG or PNG photo.'));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('That image is over 15MB — please pick a smaller one.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, name: file.name || 'photo.jpg', url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image — try a different file.')); };
    img.src = url;
  });
}

function revokePhotoUrl() {
  if (state.photo && state.photo.url && state.photo.url.startsWith('blob:')) {
    try { URL.revokeObjectURL(state.photo.url); } catch (e) {}
  }
}

function setPhoto(photo) {
  revokePhotoUrl();
  state.photo = photo;
  el.photoThumb.src = photo.img.src;
  el.photoName.textContent = photo.name;
  el.photoReady.hidden = false;
  el.dropzone.style.display = 'none';
  document.querySelector('.samples').style.display = 'none';
  el.toStep2.disabled = false;
  document.querySelectorAll('.sample-btn').forEach((b) => b.classList.remove('is-picked'));
}

async function handleFile(file) {
  try {
    const photo = await loadImageFile(file);
    setPhoto(photo);
    toast('Photo loaded — looking good. Pick the scene →');
  } catch (err) {
    toast(err.message);
  }
}

async function loadSample(n, btn) {
  btn.disabled = true;
  try {
    const res = await fetch('assets/sample-' + n + '.jpg');
    if (!res.ok) throw new Error('sample missing');
    const blob = await res.blob();
    const photo = await loadImageFile(new File([blob], 'sample-' + n + '.jpg', { type: 'image/jpeg' }));
    document.querySelectorAll('.sample-btn').forEach((b) => b.classList.remove('is-picked'));
    btn.classList.add('is-picked');
    setPhoto(photo);
    document.querySelector('.samples').style.display = '';
    toast('Sample loaded — pick the scene →');
  } catch (err) {
    toast('Could not load the sample photo.');
  } finally {
    btn.disabled = false;
  }
}

function resetPhoto() {
  revokePhotoUrl();
  state.photo = null;
  el.photoReady.hidden = true;
  el.dropzone.style.display = '';
  document.querySelector('.samples').style.display = '';
  el.toStep2.disabled = true;
  el.fileInput.value = '';
}

/* ---------------- Gemini API ---------------- */
function imageToBase64(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.9).split(',')[1];
}

function friendlyApiError(status) {
  if (status === 400) return 'The API key looks invalid. Double-check it in key settings — copy the full key from AI Studio.';
  if (status === 401 || status === 403) return 'Google rejected the API key (unauthorized). Paste a fresh key from AI Studio.';
  if (status === 429) return 'Google refused the request — the free image quota on this key looks empty right now. On a brand-new key this usually means the quota has not activated yet (wait a few minutes, then retry) or the free image allowance is not available for this project/region. Use "Test key" in key settings to see the exact reason.';
  if (status >= 500) return 'Google\'s servers hiccupped. Wait a moment and try again.';
  return 'The API returned an error (status ' + status + '). Try again in a bit.';
}

/* Pull Google's raw error message out of a failed response, for the details box. */
async function googleErrorDetail(res) {
  try {
    const ej = await res.json();
    const msg = ej && ej.error && ej.error.message;
    return msg ? ('Google said (HTTP ' + res.status + '): ' + msg) : ('HTTP ' + res.status + ' ' + (res.statusText || ''));
  } catch (e) {
    return 'HTTP ' + res.status + ' ' + (res.statusText || '');
  }
}

/* Cheap text-only call to check whether a key itself is valid.
   Distinguishes "bad key" (400/401/403) from "image quota empty" (429 on images only). */
async function testApiKey() {
  const v = el.apiKeyInput.value.trim() || getApiKey();
  if (!v) { el.apiKeyMsg.textContent = 'Paste a key first.'; el.apiKeyMsg.className = 'fineprint bad'; return; }
  el.apiKeyTest.disabled = true;
  el.apiKeyMsg.textContent = 'Testing key…';
  el.apiKeyMsg.className = 'fineprint';
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': v },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the word OK' }] }] }),
    });
    if (res.ok) {
      el.apiKeyMsg.textContent = 'Key works — Google answered. If image generation still fails with a quota error, the free image allowance (not the key) is the problem.';
      el.apiKeyMsg.className = 'fineprint ok';
    } else {
      const detail = await googleErrorDetail(res);
      el.apiKeyMsg.textContent = (res.status === 429
        ? 'Key is recognized but its quota is empty right now. '
        : 'Key problem (HTTP ' + res.status + '). ') + detail;
      el.apiKeyMsg.className = 'fineprint bad';
    }
  } catch (e) {
    el.apiKeyMsg.textContent = 'Could not reach Google — check your connection and retry.';
    el.apiKeyMsg.className = 'fineprint bad';
  } finally {
    el.apiKeyTest.disabled = false;
  }
}

const GEN_TICKER = [
  'Waking the mask…',
  'Fog rolling in…',
  'He steps closer…',
  'Adjusting the lighting…',
  'Don\'t look behind you…',
  'Almost there…',
];
let genTickTimer = null;

async function generate() {
  if (state.generating) return;
  const key = getApiKey();
  if (!key) { openSettings('Paste your free Gemini API key first — it takes 30 seconds.'); return; }
  if (!state.photo) { toast('Add a photo first.'); showStep(1); return; }

  state.generating = true;
  showStep(3);
  el.result.hidden = true;
  el.genError.hidden = true;
  el.genErrorDetails.hidden = true;
  el.generating.hidden = false;
  let tick = 0;
  el.genStatus.textContent = GEN_TICKER[0];
  genTickTimer = setInterval(() => {
    tick = (tick + 1) % GEN_TICKER.length;
    el.genStatus.textContent = GEN_TICKER[tick];
  }, 2600);

  try {
    const b64 = imageToBase64(state.photo.img, UPLOAD_MAX_SIDE);
    const prompt = buildPrompt(state.scene, el.customPrompt.value);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [
          { inlineData: { mimeType: 'image/jpeg', data: b64 } },
          { text: prompt },
        ] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });
    if (!res.ok) {
      const detail = await googleErrorDetail(res);
      const err = new Error(friendlyApiError(res.status));
      err.detail = detail;
      throw err;
    }
    const json = await res.json();
    const parts = (((json.candidates || [])[0] || {}).content || {}).parts || [];
    const imgPart = parts.find((p) => p.inlineData && p.inlineData.data);
    if (!imgPart) throw new Error('The model answered without an image. Try again — sometimes it needs a second attempt.');
    const mime = imgPart.inlineData.mimeType || 'image/png';
    state.result = 'data:' + mime + ';base64,' + imgPart.inlineData.data;
    showResult();
  } catch (err) {
    el.genErrorMsg.textContent = err.message || 'Something went wrong.';
    if (err.detail) {
      el.genErrorDetail.textContent = err.detail;
      el.genErrorDetails.hidden = false;
    } else {
      el.genErrorDetails.hidden = true;
    }
    el.genError.hidden = false;
  } finally {
    clearInterval(genTickTimer);
    el.generating.hidden = true;
    state.generating = false;
  }
}

function showResult() {
  const pro = isPro();
  el.resultImg.src = state.result;
  el.resultBadge.textContent = pro ? 'PRO · clean 2048px' : 'FREE · watermarked';
  el.resultBadge.classList.toggle('pro', pro);
  el.proNudge.style.display = pro ? 'none' : '';
  el.result.hidden = false;
}

/* ---------------- watermark + export ----------------
   Free exports are 1024px with the watermark baked into the
   PNG pixels (corner pill, light diagonal marks, center line)
   so screenshots and Inspect Element can't strip it. */
function drawWatermark(ctx, w, h) {
  ctx.save();
  const fontFam = "'Plus Jakarta Sans', system-ui, sans-serif";

  // light diagonal marks
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 ' + Math.round(h * 0.038) + 'px ' + fontFam;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(w / 2, h * 0.30);
  ctx.rotate(-0.42);
  ctx.fillText('GhostFace Studio', 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(w / 2, h * 0.68);
  ctx.rotate(-0.42);
  ctx.fillText('GhostFace Studio', 0, 0);
  ctx.restore();

  // center line
  ctx.globalAlpha = 0.42;
  ctx.font = '700 ' + Math.round(h * 0.026) + 'px ' + fontFam;
  ctx.fillText('GhostFace Studio — Go Pro to remove', w / 2, h * 0.52);

  // corner pill
  ctx.globalAlpha = 0.92;
  const label = 'Made with GhostFace Studio';
  ctx.font = '700 ' + Math.round(h * 0.020) + 'px ' + fontFam;
  const tw = ctx.measureText(label).width;
  const pw = tw + 36, ph = Math.round(h * 0.042);
  const px = w - pw - 18, py = h - ph - 18;
  ctx.fillStyle = 'rgba(10, 7, 5, 0.82)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, ph / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 90, 31, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#F5EFE6';
  ctx.textAlign = 'left';
  ctx.fillText(label, px + 18, py + ph * 0.68);
  ctx.restore();
}

function exportImage() {
  if (!state.result) return;
  const pro = isPro(); // re-validated on EVERY export
  const img = new Image();
  img.onload = () => {
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const maxSide = pro ? PRO_MAX_SIDE : FREE_MAX_SIDE;
    // Export at exactly the tier's resolution: 1024px free / 2048px pro.
    const s = maxSide / longest;
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    if (!pro) drawWatermark(ctx, w, h);
    const a = document.createElement('a');
    a.download = 'ghostface-studio-' + (pro ? 'pro' : 'free') + '.png';
    a.href = c.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(pro ? 'Pro export downloaded — 2048px, clean.' : 'Downloaded with watermark — Go Pro for the clean 2048px version.');
  };
  img.onerror = () => toast('Could not prepare the download.');
  img.src = state.result;
}

/* ---------------- captions ---------------- */
function copyCaption() {
  const scene = SCENES[state.scene] || SCENES.lurking;
  const cap = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];
  const text = cap.text + '\n' + cap.tags + '\n\nMade with GhostFace Studio 🔪';
  const done = () => toast('Caption + hashtags copied — paste it on TikTok.');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); }
  catch (e) { toast('Copy failed — long-press to copy manually.'); }
  ta.remove();
}

/* ---------------- pro unlock ---------------- */
function applyKey() {
  const k = el.keyInput.value;
  if (validateKey(k)) {
    try { localStorage.setItem(LS_PRO_KEY, String(k).trim().toUpperCase()); } catch (e) {}
    el.keyMsg.textContent = 'Pro unlocked — watermark-free 2048px exports are yours.';
    el.keyMsg.className = 'fineprint ok';
    if (state.result) showResult();
  } else {
    el.keyMsg.textContent = 'That key doesn\'t look valid — check it and try again.';
    el.keyMsg.className = 'fineprint bad';
  }
}

/* ---------------- events ---------------- */
function init() {
  document.querySelectorAll('[data-pro-price]').forEach((n) => { n.textContent = PRO_PRICE; });

  // upload
  el.dropzone.addEventListener('click', () => el.fileInput.click());
  el.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
  });
  el.fileInput.addEventListener('change', () => {
    if (el.fileInput.files[0]) handleFile(el.fileInput.files[0]);
  });
  ['dragenter', 'dragover'].forEach((ev) => el.dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); el.dropzone.classList.add('is-drag');
  }));
  ['dragleave', 'drop'].forEach((ev) => el.dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); el.dropzone.classList.remove('is-drag');
  }));
  el.dropzone.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  document.querySelectorAll('.sample-btn').forEach((b) => {
    b.addEventListener('click', () => loadSample(b.dataset.sample, b));
  });
  el.changePhoto.addEventListener('click', resetPhoto);

  // steps
  el.toStep2.addEventListener('click', () => showStep(2));
  el.backTo1.addEventListener('click', () => showStep(1));
  el.backTo2.addEventListener('click', () => { el.result.hidden = true; el.genError.hidden = true; showStep(2); });
  el.againBtn.addEventListener('click', generate);
  el.errorBack.addEventListener('click', () => { el.genError.hidden = true; showStep(2); });
  el.errorRetry.addEventListener('click', generate);

  // scenes
  document.querySelectorAll('.scene-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.scene-card').forEach((c) => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('is-selected');
      card.setAttribute('aria-checked', 'true');
      state.scene = card.dataset.scene;
    });
  });
  // deep link: ../app/?scene=woods
  try {
    const q = new URLSearchParams(location.search).get('scene');
    if (q && SCENES[q]) {
      const card = document.querySelector('.scene-card[data-scene="' + q + '"]');
      if (card) card.click();
    }
  } catch (e) {}

  // generate / export / caption
  el.generateBtn.addEventListener('click', generate);
  el.downloadBtn.addEventListener('click', exportImage);
  el.captionBtn.addEventListener('click', copyCaption);

  // pro
  el.goproBtn.addEventListener('click', () => window.open(PAYMENT_URL, '_blank', 'noopener'));
  el.keyApply.addEventListener('click', applyKey);
  el.keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyKey(); });

  // settings modal
  el.keyPill.addEventListener('click', () => openSettings());
  el.openSettings2.addEventListener('click', () => openSettings());
  el.settingsClose.addEventListener('click', closeSettings);
  el.settingsModal.addEventListener('click', (e) => { if (e.target === el.settingsModal) closeSettings(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.settingsModal.hidden) closeSettings(); });
  el.apiKeySave.addEventListener('click', () => {
    const v = el.apiKeyInput.value.trim();
    if (!v) { el.apiKeyMsg.textContent = 'Paste a key first.'; el.apiKeyMsg.className = 'fineprint bad'; return; }
    try { localStorage.setItem(LS_API_KEY, v); } catch (e) {}
    refreshKeyPill();
    el.apiKeyMsg.textContent = 'Key saved in this browser. You\'re ready to haunt.';
    el.apiKeyMsg.className = 'fineprint ok';
    setTimeout(closeSettings, 900);
  });
  el.apiKeyClear.addEventListener('click', () => {
    try { localStorage.removeItem(LS_API_KEY); } catch (e) {}
    el.apiKeyInput.value = '';
    refreshKeyPill();
    el.apiKeyMsg.textContent = 'Key removed from this browser.';
    el.apiKeyMsg.className = 'fineprint';
  });
  el.apiKeyTest.addEventListener('click', testApiKey);

  refreshKeyPill();

  // offline support (http/https only)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
