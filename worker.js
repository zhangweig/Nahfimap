/**
 * NahfiMap Cloudflare Worker API v2
 * 带 JWT 用户认证，数据按 user_id 隔离
 *
 * 公开端点：
 *   POST /api/auth/register  — 注册（email + password + name）
 *   POST /api/auth/login     — 登录（返回 JWT token）
 *   GET  /api/ping           — 健康检查
 *
 * 需认证端点（Authorization: Bearer <token>）：
 *   GET    /api/places         — 拉取当前用户的地点（?since=<ts> 增量）
 *   POST   /api/places/push    — 批量推送地点
 *   DELETE /api/places/:id     — 删除地点
 *   GET    /api/journeys       — 拉取当前用户的旅程
 *   POST   /api/journeys/push  — 批量推送旅程
 *   DELETE /api/journeys/:id   — 删除旅程
 *   GET    /api/me             — 获取当前用户信息
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

// ── JWT 密钥（部署后通过 wrangler secret put JWT_SECRET 设置）──
// 如果未设置密钥，使用一个 fallback（仅用于开发，生产环境务必设置）
function getSecret(env) {
  return env.JWT_SECRET || 'nahfimap-dev-secret-change-me-in-production';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

// ══════════════════════════════════
//  Web Crypto 工具函数
// ══════════════════════════════════

// 密码哈希：SHA-256 + salt
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 生成随机 salt
function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// JWT 签发
async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${message}.${sigB64}`;
}

// JWT 验证
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const message = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    // 还原 base64url → Uint8Array
    const sigStr = atob(sigB64.replace(/-/g, '+').replace(/_/g, '/'));
    const sigArr = new Uint8Array([...sigStr].map(c => c.charCodeAt(0)));
    const valid = await crypto.subtle.verify('HMAC', key, sigArr, encoder.encode(message));
    if (!valid) return null;
    const payload = JSON.parse(atob(payloadB64));
    // 检查过期（7天）
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// 从请求头提取并验证 JWT，返回 userId 或 null
async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, getSecret(env));
  return payload ? payload.uid : null;
}

// ══════════════════════════════════
//  主入口
// ══════════════════════════════════

export default {
  async fetch(request, env) {
    // ── Preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const method = request.method;

    // ── 初始化表 ──
    const createTables = [
      `CREATE TABLE IF NOT EXISTS users (
        id         TEXT PRIMARY KEY,
        email      TEXT UNIQUE NOT NULL,
        name       TEXT NOT NULL,
        salt       TEXT NOT NULL,
        password   TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS places (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT 0,
        deleted    INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS journeys (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT 0,
        deleted    INTEGER NOT NULL DEFAULT 0
      )`,
    ];
    for (const sql of createTables) {
      try { await env.DB.exec(sql); } catch (e) { /* 表已存在，忽略 */ }
    }

    // ════ 公开路由 ════

    // GET /api/ping
    if (path === '/api/ping' && method === 'GET') {
      return json({ ok: true, ts: Date.now() });
    }

    // POST /api/auth/register
    if (path === '/api/auth/register' && method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const { email, password, name } = body;
      if (!email || !password || !name) return err('邮箱、密码和昵称不能为空');
      if (password.length < 6) return err('密码至少 6 位');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('邮箱格式不正确');

      // 检查邮箱是否已注册
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) return err('该邮箱已被注册');

      const salt = generateSalt();
      const hashed = await hashPassword(password, salt);
      const uid = crypto.randomUUID();
      const now = Date.now();

      await env.DB.prepare(
        'INSERT INTO users (id, email, name, salt, password, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(uid, email.toLowerCase().trim(), name.trim(), salt, hashed, now).run();

      const token = await signJWT({ uid, email, name: name.trim(), exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getSecret(env));
      return json({ ok: true, token, user: { id: uid, email, name: name.trim() } }, 201);
    }

    // POST /api/auth/login
    if (path === '/api/auth/login' && method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const { email, password } = body;
      if (!email || !password) return err('邮箱和密码不能为空');

      const user = await env.DB.prepare('SELECT id, email, name, salt, password FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
      if (!user) return err('邮箱或密码错误', 401);

      const hashed = await hashPassword(password, user.salt);
      if (hashed !== user.password) return err('邮箱或密码错误', 401);

      const token = await signJWT({ uid: user.id, email: user.email, name: user.name, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getSecret(env));
      return json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name } });
    }

    // ════ 需认证路由 ════
    const userId = await authenticate(request, env);
    if (!userId) return err('未登录或 token 已过期，请重新登录', 401);

    // GET /api/me
    if (path === '/api/me' && method === 'GET') {
      const user = await env.DB.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').bind(userId).first();
      if (!user) return err('用户不存在', 404);
      return json({ ok: true, user });
    }

    // ── Places ──

    // GET /api/places
    if (path === '/api/places' && method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0', 10);
      let rows;
      if (since > 0) {
        rows = await env.DB.prepare(
          'SELECT id, data, updated_at, deleted FROM places WHERE user_id = ? AND updated_at > ?'
        ).bind(userId, since).all();
      } else {
        rows = await env.DB.prepare(
          'SELECT id, data, updated_at, deleted FROM places WHERE user_id = ? AND deleted = 0'
        ).bind(userId).all();
      }
      const places = (rows.results || []).map(r => ({
        ...JSON.parse(r.data),
        id: r.id,
        updatedAt: r.updated_at,
        _deleted: r.deleted === 1,
      }));
      return json({ ok: true, places, serverTs: Date.now() });
    }

    // POST /api/places/push
    if (path === '/api/places/push' && method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const items = Array.isArray(body.places) ? body.places : [];
      if (!items.length) return json({ ok: true, upserted: 0 });

      const stmt = env.DB.prepare(
        'INSERT INTO places (id, user_id, data, updated_at, deleted) VALUES (?1, ?2, ?3, ?4, 0) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted=0 WHERE excluded.updated_at >= places.updated_at AND places.user_id = excluded.user_id'
      );
      const now = Date.now();
      const batch = items.map(item => {
        const { id, updatedAt, _deleted, ...rest } = item;
        const ts = updatedAt || now;
        return stmt.bind(String(id), userId, JSON.stringify(rest), ts);
      });
      await env.DB.batch(batch);
      return json({ ok: true, upserted: items.length, serverTs: now });
    }

    // DELETE /api/places/:id
    const delPlaceMatch = path.match(/^\/api\/places\/(.+)$/);
    if (delPlaceMatch && method === 'DELETE') {
      const id = delPlaceMatch[1];
      const now = Date.now();
      await env.DB.prepare(
        'UPDATE places SET deleted=1, updated_at=? WHERE id=? AND user_id=?'
      ).bind(now, id, userId).run();
      return json({ ok: true, deleted: id, serverTs: now });
    }

    // ── Journeys ──

    // GET /api/journeys
    if (path === '/api/journeys' && method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0', 10);
      let rows;
      if (since > 0) {
        rows = await env.DB.prepare(
          'SELECT id, data, updated_at, deleted FROM journeys WHERE user_id = ? AND updated_at > ?'
        ).bind(userId, since).all();
      } else {
        rows = await env.DB.prepare(
          'SELECT id, data, updated_at, deleted FROM journeys WHERE user_id = ? AND deleted = 0'
        ).bind(userId).all();
      }
      const journeys = (rows.results || []).map(r => ({
        ...JSON.parse(r.data),
        id: r.id,
        updatedAt: r.updated_at,
        _deleted: r.deleted === 1,
      }));
      return json({ ok: true, journeys, serverTs: Date.now() });
    }

    // POST /api/journeys/push
    if (path === '/api/journeys/push' && method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const items = Array.isArray(body.journeys) ? body.journeys : [];
      if (!items.length) return json({ ok: true, upserted: 0 });

      const stmt = env.DB.prepare(
        'INSERT INTO journeys (id, user_id, data, updated_at, deleted) VALUES (?1, ?2, ?3, ?4, 0) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted=0 WHERE excluded.updated_at >= journeys.updated_at AND journeys.user_id = excluded.user_id'
      );
      const now = Date.now();
      const batch = items.map(item => {
        const { id, updatedAt, _deleted, ...rest } = item;
        const ts = updatedAt || now;
        return stmt.bind(String(id), userId, JSON.stringify(rest), ts);
      });
      await env.DB.batch(batch);
      return json({ ok: true, upserted: items.length, serverTs: now });
    }

    // DELETE /api/journeys/:id
    const delJourneyMatch = path.match(/^\/api\/journeys\/(.+)$/);
    if (delJourneyMatch && method === 'DELETE') {
      const id = delJourneyMatch[1];
      const now = Date.now();
      await env.DB.prepare(
        'UPDATE journeys SET deleted=1, updated_at=? WHERE id=? AND user_id=?'
      ).bind(now, id, userId).run();
      return json({ ok: true, deleted: id, serverTs: now });
    }

    return err('Not found', 404);
  },
};
