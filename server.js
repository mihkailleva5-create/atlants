// ATLANTIS — static server + Telegram auth + cloud saves
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Minimal .env loader (no dependencies)
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) { /* ignore */ }
}
loadEnv();

const root = __dirname;
const publicDir = path.join(root, 'public');
const savesDir = path.join(root, 'saves');
const port = process.env.PORT || 8080;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_NAME = process.env.TELEGRAM_BOT_NAME || '';

if (!fs.existsSync(savesDir)) fs.mkdirSync(savesDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

function send(p, res) {
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(p).pipe(res);
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 5 * 1024 * 1024) req.destroy(); });
    req.on('end', () => resolve(d));
    req.on('error', () => resolve(''));
  });
}

// ---- Telegram signature verification ----

// Login Widget: callback has standard field names, data-check string uses auth_* names
function verifyTelegramLogin(data, hash) {
  if (!BOT_TOKEN) return { ok: false, error: 'Bot token not configured' };
  // Map callback fields to auth_* names (per Telegram Login Widget spec)
  const mapping = {
    id: 'auth_user_id',
    first_name: 'auth_name',
    username: 'auth_username',
    photo_url: 'auth_photo_url',
    auth_date: 'auth_date',
  };
  const fields = {};
  for (const [src, dst] of Object.entries(mapping)) {
    if (data[src] !== undefined) fields[dst] = String(data[src]);
  }
  const keys = Object.keys(fields).sort();
  const dataCheckString = keys.map((k) => `${k}=${fields[k]}`).join('\n');
  const secretKey = crypto.createHmac('sha256', BOT_TOKEN).update(dataCheckString).digest();
  const computedHash = crypto.createHash('sha256').update(secretKey).digest('base64');
  return { ok: computedHash === hash, dataCheckString };
}

// Mini App WebApp: initData is a URL-encoded query string
function verifyTelegramWebApp(initData) {
  if (!BOT_TOKEN) return { ok: false, error: 'Bot token not configured' };
  const params = new URLSearchParams(initData);
  const data = {};
  for (const [k, v] of params) data[k] = v;
  const hash = data.hash;
  if (!hash) return { ok: false, error: 'No hash in initData' };
  delete data.hash;
  // Include ALL fields (even empty) — Telegram includes them in data-check string
  const keys = Object.keys(data).sort();
  const dataCheckString = keys.map((k) => `${k}=${data[k]}`).join('\n');
  const secretKey = crypto.createHmac('sha256', BOT_TOKEN).update(dataCheckString).digest();
  const computedHash = crypto.createHash('sha256').update(secretKey).digest('base64');
  return { ok: computedHash === hash, data, dataCheckString };
}

// ---- Session tokens ----
function makeToken(userId) {
  return crypto.createHmac('sha256', BOT_TOKEN || 'atlantis-dev-secret').update(String(userId)).digest('base64');
}
function verifyToken(token, userId) {
  if (!token || !userId) return false;
  return token === makeToken(userId);
}

// ---- Save storage ----
function saveFile(userId) { return path.join(savesDir, `${userId}.json`); }
function loadSaveFile(userId) {
  try { return JSON.parse(fs.readFileSync(saveFile(userId), 'utf8')); }
  catch (e) { return null; }
}
function writeSaveFile(userId, data) {
  fs.writeFileSync(saveFile(userId), JSON.stringify(data));
}
function saveExists(userId) { return fs.existsSync(saveFile(userId)); }

// ---- Auth handler ----
async function handleAuth(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJSON(res, 400, { ok: false, error: 'Invalid JSON' }); }
  const authData = body.authData || body;

  // Mini App WebApp path
  if (authData.initData) {
    const result = verifyTelegramWebApp(authData.initData);
    if (!result.ok) return sendJSON(res, 401, { ok: false, error: result.error || 'Invalid signature' });
    // user field is a JSON string inside initData
    let userObj = {};
    try { userObj = JSON.parse(result.data.user || '{}'); } catch (e) { /* no user field */ }
    const userId = userObj.id || result.data.id;
    if (!userId) return sendJSON(res, 401, { ok: false, error: 'No user id' });
    const user = {
      id: userId,
      first_name: userObj.first_name || '',
      last_name: userObj.last_name || '',
      username: userObj.username || '',
      photo_url: userObj.photo_url || '',
    };
    return sendJSON(res, 200, { ok: true, userId, user, token: makeToken(userId) });
  }

  // Login Widget path
  const hash = authData.hash;
  if (!hash) return sendJSON(res, 400, { ok: false, error: 'No hash' });
  const result = verifyTelegramLogin(authData, hash);
  if (!result.ok) return sendJSON(res, 401, { ok: false, error: result.error || 'Invalid signature' });
  const userId = authData.id;
  if (!userId) return sendJSON(res, 401, { ok: false, error: 'No user id' });
  const user = {
    id: userId,
    first_name: authData.first_name || '',
    last_name: authData.last_name || '',
    username: authData.username || '',
    photo_url: authData.photo_url || '',
  };
  return sendJSON(res, 200, { ok: true, userId, user, token: makeToken(userId) });
}

// ---- Save handlers ----
function handleSaveGet(req, res, query) {
  const token = query.token;
  const userId = query.userId;
  if (!token || !userId) return sendJSON(res, 400, { ok: false, error: 'Missing params' });
  if (!verifyToken(token, userId)) return sendJSON(res, 403, { ok: false, error: 'Invalid token' });
  const data = loadSaveFile(userId);
  if (!data) return sendJSON(res, 200, { ok: true, state: null });
  return sendJSON(res, 200, { ok: true, state: data.state || null, savedAt: data.savedAt });
}

async function handleSavePost(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJSON(res, 400, { ok: false, error: 'Invalid JSON' }); }
  const { token, userId, state } = body;
  if (!token || !userId) return sendJSON(res, 400, { ok: false, error: 'Missing params' });
  if (!verifyToken(token, userId)) return sendJSON(res, 403, { ok: false, error: 'Invalid token' });
  if (!state || typeof state !== 'object') return sendJSON(res, 400, { ok: false, error: 'Invalid state' });
  writeSaveFile(userId, { userId, state, savedAt: Date.now() });
  return sendJSON(res, 200, { ok: true });
}

function handleProfile(req, res, query) {
  const token = query.token;
  const userId = query.userId;
  if (!token || !userId) return sendJSON(res, 400, { ok: false, error: 'Missing params' });
  if (!verifyToken(token, userId)) return sendJSON(res, 403, { ok: false, error: 'Invalid token' });
  if (!saveExists(userId)) return sendJSON(res, 200, { ok: true, exists: false });
  const data = loadSaveFile(userId);
  return sendJSON(res, 200, { ok: true, exists: true, savedAt: data.savedAt, stateSize: JSON.stringify(data.state || {}).length });
}

async function handleSaveReset(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJSON(res, 400, { ok: false, error: 'Invalid JSON' }); }
  const { token, userId } = body;
  if (!token || !userId) return sendJSON(res, 400, { ok: false, error: 'Missing params' });
  if (!verifyToken(token, userId)) return sendJSON(res, 403, { ok: false, error: 'Invalid token' });
  const file = saveFile(userId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return sendJSON(res, 200, { ok: true });
}

// ---- Server ----
http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const queryStr = req.url.split('?')[1] || '';
  const query = Object.fromEntries(new URLSearchParams(queryStr));

  // CORS + preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API routes
  if (url === '/api/config' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, botName: BOT_NAME, hasToken: !!BOT_TOKEN, domain: process.env.TELEGRAM_DOMAIN || '' });
  }
  if (url === '/api/auth/telegram' && req.method === 'POST') return handleAuth(req, res);
  if (url === '/api/save' && req.method === 'GET') return handleSaveGet(req, res, query);
  if (url === '/api/save' && req.method === 'POST') return handleSavePost(req, res);
  if (url === '/api/profile' && req.method === 'GET') return handleProfile(req, res, query);
  if (url === '/api/save/reset' && req.method === 'POST') return handleSaveReset(req, res);
  if (url === '/api/health' && req.method === 'GET') return sendJSON(res, 200, { ok: true, uptime: process.uptime() });

  // Static files
  if (url === '/' || url === '') {
    return send(path.join(root, 'index.html'), res);
  }
  const candidates = [
    path.normalize(path.join(root, url)),
    path.normalize(path.join(publicDir, url)),
  ];
  fs.stat(candidates[0], (e0, st0) => {
    if (!e0 && st0.isFile()) { send(candidates[0], res); return; }
    fs.stat(candidates[1], (e1, st1) => {
      if (e1 || !st1.isFile()) {
        res.writeHead(404);
        res.end('404 Not Found: ' + url);
        return;
      }
      send(candidates[1], res);
    });
  });
}).listen(port, '0.0.0.0', () => {
  console.log('ATLANTIS ready at http://0.0.0.0:' + port);
  console.log('  Telegram bot: ' + (BOT_NAME ? '@' + BOT_NAME : 'NOT CONFIGURED (localStorage fallback)'));
  console.log('  Saves dir: ' + savesDir);
});
