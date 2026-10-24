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
  widgetRendered: false,
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

// ---- global callback for Login Widget ----
window.onTelegramAuth = async function(user) {
  // user: { id, first_name, last_name, username, photo_url, auth_date, hash }
  try {
    const r = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authData: user }),
    });
    const d = await r.json();
    if (d.ok) {
      TG.user = d.user;
      TG.token = d.token;
      TG.userId = d.userId;
      TG.ready = true;
      emit();
      return true;
    }
    console.error('Telegram auth failed:', d.error);
  } catch (e) {
    console.error('Telegram auth error:', e);
  }
  return false;
};

// ---- auth flow ----
export async function initAuth() {
  await loadConfig();

  // 0. Check localStorage for existing auth (from widget callback reload)
  const savedToken = localStorage.getItem('tg_token');
  const savedUser = localStorage.getItem('tg_user');
  const savedUserId = localStorage.getItem('tg_user_id');
  if (savedToken && savedUser && savedUserId) {
    try {
      TG.user = JSON.parse(savedUser);
      TG.token = savedToken;
      TG.userId = savedUserId;
      TG.ready = true;
      emit();
      return true;
    } catch (e) { /* corrupted data */ }
  }

  // 1. Try WebApp if inside Telegram Mini App
  if (isWebApp()) {
    const wa = webApp();
    wa.ready();
    wa.enableClosingConfirmation();
    if (wa.initData) {
      try {
        const r = await fetch(AUTH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authData: { initData: wa.initData } }),
        });
        const d = await r.json();
        if (d.ok) {
          TG.user = d.user;
          TG.token = d.token;
          TG.userId = d.userId;
          TG.ready = true;
          emit();
          return true;
        }
      } catch (e) { /* fall through to widget */ }
    }
  }

  // 2. Render Login Widget (if not in WebApp)
  if (!TG.ready && TG.config.hasToken && TG.config.botName) {
    renderLoginWidget();
  }

  return !!TG.ready;
}

// ---- render Login Widget as HTML element ----
function renderLoginWidget() {
  if (TG.widgetRendered) return;
  TG.widgetRendered = true;

  // Create the widget element
  const widget = document.createElement('telegram-login-widget');
  widget.setAttribute('data-bot-name', TG.config.botName);
  widget.setAttribute('data-size', 'large');
  widget.setAttribute('data-onauth', 'onTelegramAuth(user)');
  widget.setAttribute('data-request-access', 'write');
  widget.setAttribute('data-userpic', 'false');
  widget.setAttribute('data-style', 'bubbles');
  widget.setAttribute('data-corner-radius', '12');

  // Place it in a visible container
  const container = document.getElementById('tg-widget-container');
  if (container) {
    container.appendChild(widget);
  } else {
    // Fallback: create a container
    const c = document.createElement('div');
    c.id = 'tg-widget-container';
    c.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:45;';
    c.appendChild(widget);
    document.body.appendChild(c);
  }
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

export function logout() {
  TG.user = null;
  TG.token = null;
  TG.userId = null;
  TG.ready = false;
  emit();
}
