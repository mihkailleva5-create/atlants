// Telegram auth + cloud save sync.
// Supports: Telegram Login Widget (web) + Telegram WebApp (Mini App).
// Falls back to localStorage when no bot token configured.

const CONFIG_URL = '/api/config';
const AUTH_URL = '/api/auth/telegram';
const SAVE_URL = '/api/save';
const PROFILE_URL = '/api/profile';
const RESET_URL = '/api/save/reset';

export const TG = {
  config: { botName: '', hasToken: false, domain: '' },
  user: null,        // { id, first_name, last_name, username, photo_url }
  token: null,       // session token
  userId: null,
  ready: false,      // logged in via Telegram
  initialized: false,
  _onChange: null,
};

export function setOnChange(fn) { TG._onChange = fn; }
function emit() { if (TG._onChange) TG._onChange(TG); }

// ---- config ----
export async function loadConfig() {
  try {
    const r = await fetch(CONFIG_URL, { cache: 'no-store' });
    const d = await r.json();
    TG.config = d;
  } catch (e) { /* offline */ }
  TG.initialized = true;
  return TG.config;
}

// ---- WebApp (Mini App inside Telegram) ----
function webApp() {
  return typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp;
}

export function isWebApp() {
  return !!(webApp() && webApp().ready);
}

// ---- Login Widget (web page with <telegram-login-widget>) ----
function loginWidget() {
  return typeof window !== 'undefined' && window.TelegramLoginWidget;
}

// ---- auth flow ----
export async function initAuth() {
  await loadConfig();
  // 1. Try WebApp if inside Telegram
  if (isWebApp()) {
    const wa = webApp();
    wa.ready();
    wa.enableClosingConfirmation();
    // initData is a URL-encoded query string with hash
    if (wa.initData) {
      try {
        const r = await fetch(AUTH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authData: { initData: wa.initData } }),
        });
        const d = await r.json();
        if (d.ok) { setUser(d); emit(); return true; }
      } catch (e) { /* fall through to widget */ }
    }
  }
  // 2. Try Login Widget if present
  if (loginWidget()) {
    const widget = new window.TelegramLoginWidget();
    widget.setButtonPath('/tg/login');
    widget.setHandler((user) => {
      userAuth(user).then((ok) => { if (ok) emit(); });
    });
    widget.render();
  }
  return !!TG.ready;
}

// manual: set initData from WebApp (if called after ready)
export async function webAppAuth(initData) {
  const r = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authData: { initData } }),
  });
  const d = await r.json();
  if (d.ok) { setUser(d); emit(); return true; }
  return false;
}

export async function userAuth(user) {
  try {
    const r = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authData: user }),
    });
    const d = await r.json();
    if (d.ok) { setUser(d); emit(); return true; }
  } catch (e) { /* offline */ }
  return false;
}

function setUser(d) {
  TG.user = d.user;
  TG.token = d.token;
  TG.userId = d.userId;
  TG.ready = true;
}

export function logout() {
  TG.user = null;
  TG.token = null;
  TG.userId = null;
  TG.ready = false;
  emit();
}

// ---- save sync ----
export async function loadSave() {
  if (!TG.ready || !TG.token || !TG.userId) return null;
  try {
    const r = await fetch(`${SAVE_URL}?token=${encodeURIComponent(TG.token)}&userId=${encodeURIComponent(TG.userId)}`, { cache: 'no-store' });
    const d = await r.json();
    if (d.ok && d.state) return d.state;
  } catch (e) { /* offline */ }
  return null;
}

export async function saveSave(state) {
  if (!TG.ready || !TG.token || !TG.userId) return false;
  try {
    const r = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TG.token, userId: TG.userId, state }),
    });
    const d = await r.json();
    return d.ok;
  } catch (e) { /* offline */ }
  return false;
}

export async function getProfile() {
  if (!TG.ready || !TG.token || !TG.userId) return { exists: false };
  try {
    const r = await fetch(`${PROFILE_URL}?token=${encodeURIComponent(TG.token)}&userId=${encodeURIComponent(TG.userId)}`, { cache: 'no-store' });
    const d = await r.json();
    return d;
  } catch (e) { return { exists: false }; }
}

export async function resetSave() {
  if (!TG.ready || !TG.token || !TG.userId) return false;
  try {
    const r = await fetch(RESET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TG.token, userId: TG.userId }),
    });
    const d = await r.json();
    return d.ok;
  } catch (e) { return false; }
}

// ---- widget loader (for index.html) ----
export function loadLoginWidgetScript() {
  return new Promise((resolve) => {
    if (typeof window.TelegramLoginWidget !== 'undefined') return resolve(true);
    if (!TG.config.hasToken) return resolve(false);
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?2';
    s.onload = () => resolve(!!window.TelegramLoginWidget);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}
