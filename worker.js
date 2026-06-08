/**
 * NahfiMap Cloudflare Worker API
 * 处理 D1 数据库的 CRUD 操作，支持增量云同步
 *
 * 端点：
 *   GET    /api/places         — 拉取全部地点
 *   GET    /api/places/since   — 增量拉取（?t=timestamp）
 *   POST   /api/places/push    — 批量推送（新增/更新）
 *   DELETE /api/places/:id     — 删除单条
 *   GET    /api/journeys        — 拉取全部旅程
 *   POST   /api/journeys/push   — 批量推送旅程
 *   DELETE /api/journeys/:id    — 删除旅程
 *   GET    /api/ping            — 健康检查
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Device-Id',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

export default {
  async fetch(request, env) {
    // ── Preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const method = request.method;

    // ── 初始化表（首次请求自动建表）──
    try {
      await env.DB.exec(`
        CREATE TABLE IF NOT EXISTS places (
          id         TEXT PRIMARY KEY,
          data       TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT 0,
          deleted    INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS journeys (
          id         TEXT PRIMARY KEY,
          data       TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT 0,
          deleted    INTEGER NOT NULL DEFAULT 0
        );
      `);
    } catch (e) {
      // 表已存在，忽略
    }

    // ════ ROUTES ════

    // GET /api/ping
    if (path === '/api/ping' && method === 'GET') {
      return json({ ok: true, ts: Date.now() });
    }

    // ── Places ──

    // GET /api/places — 全量拉取（不含已删除）
    if (path === '/api/places' && method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0', 10);
      let rows;
      if (since > 0) {
        rows = await env.DB.prepare(
          'SELECT id, data, updated_at, deleted FROM places WHERE updated_at > ?'
        ).bind(since).all();
      } else {
        rows = await env.DB.prepare(
          'SELECT id, data, updated_at, deleted FROM places WHERE deleted = 0'
        ).all();
      }
      const places = (rows.results || []).map(r => ({
        ...JSON.parse(r.data),
        id: r.id,
        updatedAt: r.updated_at,
        _deleted: r.deleted === 1,
      }));
      return json({ ok: true, places, serverTs: Date.now() });
    }

    // POST /api/places/push — 批量推送（upsert）
    if (path === '/api/places/push' && method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const items = Array.isArray(body.places) ? body.places : [];
      if (!items.length) return json({ ok: true, upserted: 0 });

      const stmt = env.DB.prepare(
        'INSERT INTO places (id, data, updated_at, deleted) VALUES (?1, ?2, ?3, 0) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted=0 WHERE excluded.updated_at >= places.updated_at'
      );
      const now = Date.now();
      const batch = items.map(item => {
        const { id, updatedAt, _deleted, ...rest } = item;
        const ts = updatedAt || now;
        return stmt.bind(String(id), JSON.stringify(rest), ts);
      });
      await env.DB.batch(batch);
      return json({ ok: true, upserted: items.length, serverTs: now });
    }

    // DELETE /api/places/:id — 软删除
    const delPlaceMatch = path.match(/^\/api\/places\/(.+)$/);
    if (delPlaceMatch && method === 'DELETE') {
      const id = delPlaceMatch[1];
      const now = Date.now();
      await env.DB.prepare(
        'UPDATE places SET deleted=1, updated_at=? WHERE id=?'
      ).bind(now, id).run();
      return json({ ok: true, deleted: id, serverTs: now });
    }

    // ── Journeys ──

    // GET /api/journeys
    if (path === '/api/journeys' && method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0', 10);
      let rows;
      if (since > 0) {
        rows = await env.DB.prepare(
          'SELECT id, data, updated_at, deleted FROM journeys WHERE updated_at > ?'
        ).bind(since).all();
      } else {
        rows = await env.DB.prepare(
          'SELECT id, data, updated_at, deleted FROM journeys WHERE deleted = 0'
        ).all();
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
        'INSERT INTO journeys (id, data, updated_at, deleted) VALUES (?1, ?2, ?3, 0) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted=0 WHERE excluded.updated_at >= journeys.updated_at'
      );
      const now = Date.now();
      const batch = items.map(item => {
        const { id, updatedAt, _deleted, ...rest } = item;
        const ts = updatedAt || now;
        return stmt.bind(String(id), JSON.stringify(rest), ts);
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
        'UPDATE journeys SET deleted=1, updated_at=? WHERE id=?'
      ).bind(now, id).run();
      return json({ ok: true, deleted: id, serverTs: now });
    }

    return err('Not found', 404);
  },
};
