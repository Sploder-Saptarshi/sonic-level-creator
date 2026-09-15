// test-sw.js — root-scope Service Worker for in-place level testing.
//
// Intercepts POSTs to /amfphp/gateway.php (the AMF0 endpoint the stock
// games/swf/52/52.swf talks to) and answers WITHOUT touching the server:
//   - LevelEditorAPI.getLevel -> the CSV staged by the editor (BIN+ACT
//     decimal bytes, same format Utilities.readStringArray expects).
//   - PlaySEGA session calls (insertCoin/getNonce/levelUp/pause/...) ->
//     the same stub values amfphp/gateway.php returns.
//   - getLevel with nothing staged -> a locally-built Green Hill fallback
//     (same BIN+ACT the server would serve, assembled from static files).
// Gateway traffic is ALWAYS answered locally: the server's stored blob is
// stale relative to the editor grid, and the SWF caches the first getLevel
// answer per movie load — so any network passthrough permanently poisons
// the test session with a stale level.
//
// The editor stages/clears the level via postMessage:
//   { type: 'stage-level', csv: '0,0,...' } / { type: 'clear-level' }
// A stage request is acknowledged on the MessageChannel port (if any) as
// soon as the CSV is in memory, so the editor never waits on disk I/O;
// persistence to Cache Storage continues in the background.

const te = new TextEncoder();
const td = new TextDecoder();

// Staged level CSV (editor memory -> served to the SWF, never leaves browser).
let stagedCSV = null;

// Cache Storage backing so a worker restart (browsers kill idle workers)
// cannot revert to a stale level: memory is authoritative, the persisted
// copy is only consulted when memory is empty.
const STAGE_CACHE = 'test-level-v1';
const STAGE_KEY = '/__staged-level-csv__';

async function persistStaged(csv) {
  const c = await caches.open(STAGE_CACHE);
  if (csv === null || csv === undefined) await c.delete(STAGE_KEY);
  else await c.put(STAGE_KEY, new Response(csv, { headers: { 'Content-Type': 'text/plain' } }));
}

async function readPersisted() {
  const c = await caches.open(STAGE_CACHE);
  const r = await c.match(STAGE_KEY);
  return r ? r.text() : null;
}

// Local Green Hill fallback (mirrors amfphp/gateway.php zone_bytes('gh')),
// assembled from static data files — no gateway.php request involved.
let fallbackCSV = null;
async function getFallbackCSV() {
  if (fallbackCSV !== null) return fallbackCSV;
  const [binRes, actRes] = await Promise.all([
    fetch('/games/swf/52/res/data/default/mc_gh_map_data.bin'),
    fetch('/games/swf/52/res/data/default/ZONE1ACT.act'),
  ]);
  if (!binRes.ok || !actRes.ok) throw new Error('fallback level files missing');
  const [bin, act] = await Promise.all([binRes.arrayBuffer(), actRes.arrayBuffer()]);
  const bytes = new Uint8Array(bin.byteLength + act.byteLength);
  bytes.set(new Uint8Array(bin), 0);
  bytes.set(new Uint8Array(act), bin.byteLength);
  const parts = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) parts[i] = String(bytes[i]);
  fallbackCSV = parts.join(',');
  return fallbackCSV;
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || typeof d.type !== 'string') return;
  if (d.type === 'stage-level' && typeof d.csv === 'string') {
    stagedCSV = d.csv;
    // Acknowledge immediately from memory: the fetch handler serves from
    // memory, so nothing on the editor's Test path waits on disk I/O.
    // Persistence continues in the background (waitUntil keeps the worker
    // alive for it) and only matters for worker restarts before Test.
    if (e.ports && e.ports[0]) { try { e.ports[0].postMessage({ type: 'staged' }); } catch (_) {} }
    e.waitUntil((async () => {
      try { await persistStaged(d.csv); } catch (_) { /* memory copy still serves */ }
    })());
  } else if (d.type === 'clear-level') {
    stagedCSV = null;
    if (e.ports && e.ports[0]) { try { e.ports[0].postMessage({ type: 'cleared' }); } catch (_) {} }
    e.waitUntil((async () => { try { await persistStaged(null); } catch (_) {} })());
  }
});

// ── AMF0 reader (mirrors amfphp/gateway.php Amf0Reader) ──

function makeReader(buf) {
  return { dv: new DataView(buf), p: 0 };
}

function rU8(r) { return r.dv.getUint8(r.p++); }
function rU16(r) { const v = r.dv.getUint16(r.p); r.p += 2; return v; }
function rU32(r) { const v = r.dv.getUint32(r.p); r.p += 4; return v; }
function rI32(r) { const v = r.dv.getInt32(r.p); r.p += 4; return v; }
function rF64(r) { const v = r.dv.getFloat64(r.p); r.p += 8; return v; }
function rBytes(r, n) { const b = new Uint8Array(r.dv.buffer, r.dv.byteOffset + r.p, n); r.p += n; return b; }
function rStr(r) { const n = rU16(r); return td.decode(rBytes(r, n)); }
function rLongStr(r) { const n = rU32(r); return td.decode(rBytes(r, n)); }

function rVal(r) {
  const t = rU8(r);
  switch (t) {
    case 0x00: return rF64(r);
    case 0x01: return !!rU8(r);
    case 0x02: return rStr(r);
    case 0x03: return rObj(r, false);
    case 0x05: case 0x06: return null;
    case 0x08: rU32(r); return rObj(r, true);
    case 0x0a: {
      const n = rU32(r);
      const a = [];
      for (let i = 0; i < n; i++) a.push(rVal(r));
      return a;
    }
    case 0x0b: { const v = rF64(r); rU16(r); return v; }
    case 0x0c: return rLongStr(r);
    default: throw new Error('Unknown AMF0 type 0x' + t.toString(16));
  }
}

function rObj(r, _ecma) {
  const o = {};
  for (;;) {
    if (r.dv.byteLength - r.p < 3) break;
    const klen = r.dv.getUint16(r.p);
    if (klen === 0 && r.dv.getUint8(r.p + 2) === 0x09) { r.p += 3; break; }
    const k = rStr(r);
    o[k] = rVal(r);
  }
  return o;
}

function parseEnvelope(buf) {
  const r = makeReader(buf);
  rU16(r); // version
  const hc = rU16(r);
  for (let i = 0; i < hc; i++) { rStr(r); rU8(r); const len = rU32(r); r.p += len; }
  const mc = rU16(r);
  const msgs = [];
  for (let i = 0; i < mc; i++) {
    const tgt = rStr(r);
    const resp = rStr(r);
    rI32(r); // body length (recomputed on encode)
    const body = rVal(r);
    msgs.push({ tgt, resp, body });
  }
  return msgs;
}

// ── AMF0 writer (mirrors amfphp/gateway.php amf0_wval/envelope) ──

function wBytes(out, bytes) { for (const b of bytes) out.push(b); }
function wU16(out, v) { out.push((v >>> 8) & 0xff, v & 0xff); }
function wU32(out, v) { out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); }
function wF64(out, v) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, v);
  wBytes(out, b);
}
function wStrRaw(out, s) {
  const b = te.encode(s);
  wU16(out, b.length);
  wBytes(out, b);
}
function wVal(out, v) {
  if (v === null || v === undefined) { out.push(0x05); return; }
  if (typeof v === 'boolean') { out.push(0x01, v ? 1 : 0); return; }
  if (typeof v === 'number') { out.push(0x00); wF64(out, v); return; }
  if (typeof v === 'string') {
    const b = te.encode(v);
    if (b.length < 0x10000) { out.push(0x02); wU16(out, b.length); wBytes(out, b); }
    else { out.push(0x0c); wU32(out, b.length); wBytes(out, b); }
    return;
  }
  if (Array.isArray(v)) {
    out.push(0x0a); wU32(out, v.length);
    for (const x of v) wVal(out, x);
    return;
  }
  // plain object
  out.push(0x03);
  for (const k of Object.keys(v)) { wStrRaw(out, k); wVal(out, v[k]); }
  out.push(0x00, 0x00, 0x09);
}

function buildEnvelope(respId, value) {
  const body = [];
  wVal(body, value);
  const out = [0x00, 0x00, 0x00, 0x00, 0x00, 0x01];
  wStrRaw(out, respId + '/onResult');
  wStrRaw(out, '');
  wU32(out, body.length);
  wBytes(out, body);
  return new Uint8Array(out);
}

// ── Service dispatch (mirrors amfphp/gateway.php playsega_call) ──

const NONCE = 'playsega_offline';

function dispatch(method, _args) {
  switch (method) {
    case 'insertCoin': return true;
    case 'getNonce': return NONCE;
    case 'levelUp': return 1;
    case 'pauseGame': return true;
    case 'unPause': return true;
    case 'gameOver': return [];
    case 'getScores': return '';
    case 'getNumRings': return 0;
    case 'getUsername': return 'Guest';
    case 'debit': return true;
    case 'getLevel': return stagedCSV; // null when nothing staged
    case 'publishLevel': return 'Published (local test — nothing was saved)';
    default: return null;
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'POST' || !url.pathname.endsWith('/amfphp/gateway.php')) return;
  // Fully local: never forward to the server's gateway.php. Its stored
  // blob is stale relative to the editor, and the SWF keeps the first
  // getLevel answer for the whole movie load.
  e.respondWith((async () => {
    let msgs;
    try {
      const buf = await e.request.clone().arrayBuffer();
      msgs = parseEnvelope(buf);
    } catch (_) {
      return new Response(new Uint8Array(0), { status: 400 });
    }
    // Memory first, persisted copy second (covers worker restarts between
    // staging and the title-screen click), local fallback last.
    if (stagedCSV === null) {
      try { stagedCSV = await readPersisted(); } catch (_) { /* fall through */ }
    }
    const levelCSV = stagedCSV !== null ? stagedCSV : await getFallbackCSV();
    let out = new Uint8Array(0);
    for (const m of msgs) {
      const method = m.tgt.slice(m.tgt.lastIndexOf('.') + 1);
      const args = Array.isArray(m.body) ? m.body : [m.body];
      const value = method === 'getLevel' ? levelCSV : dispatch(method, args);
      const part = buildEnvelope(m.resp, value);
      const joined = new Uint8Array(out.length + part.length);
      joined.set(out);
      joined.set(part, out.length);
      out = joined;
    }
    return new Response(out, { headers: { 'Content-Type': 'application/x-amf', 'Cache-Control': 'no-store' } });
  })());
});
