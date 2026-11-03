# AGENTS.md

## Stack

Nitro 3 server (`nitro.config.ts`, `server/`) + Eta-syntax templates + esbuild editor
bundle. Web document root is `public/` (Nitro serves it as static);
`/` and `/editors/` are SSR routes, everything else static.

- `server/templates/` — hand-written Eta-syntax `.html` templates
  (`<%= %>` escaped, `<%~ %>` raw for trusted markup only), inlined via
  `with { type: "text" }` and rendered by a minimal eval-free interpolator
  in `server/utils/page/render.ts` (the Eta package itself was dropped: its
  `new Function` compile is banned on Workers). No fs reads (Workers-safe).
- `server/routes/index.get.ts` → game page, `server/routes/editors/index.get.ts`
  → editor page. Legacy query stubs `?user= ?session= ?levelid= ?territory=
  ?title=` are still accepted (sanitized in `server/utils/page/query.ts`).
- PHP backend removed: `/amfphp/gateway.php` is natively ported to
  `server/routes/amfphp/gateway.php.post.ts`; dead `/ajax/**` +
  `/editors/save.php` scripts deleted (ticker/report/feedback call sites
  in `public/js/` are inert until ported).

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Nitro dev server (no PHP needed) — run `build:editor` first |
| `npm run build`      | Minified editor bundle + `nitro build` (preset `node_server`) |
| `npm run build:editor` | Dev (unminified) bundle `ts/main.ts` → `public/editors/assets/editor.js` |
| `npm run build:editor:prod` | Minified bundle (used by `build` + `deploy:pages`; never committed) |
| `npm run lint`       | `node --check` on the compiled `editor.js`                |
| `npm run serve`      | Run the production build (`.output/server/index.mjs`)     |
| `npm run deploy:pages` | Minified bundle + `cloudflare_pages` preset + deploy `dist/` to `sonicrelvl.pages.dev` |

> `public/editors/assets/editor.js` is gitignored build output — clone +
> `npm run build:editor` before `npm run dev`.

> Pages Functions only run on the explicit `cloudflare.pages.routes`
> include list (`nitro.config.ts`) — everything else is a free static 404,
> so scanner junk never spends invocations.

> `dev` strips `Accept-Encoding` via a dev-only middleware (nitro dev
> would otherwise brotli statics on the fly at max quality — ~8s for the
> spritesheet). Production serves prebuilt `.br`/`.gz` variants instead.

Workers deploy: `NITRO_PRESET=cloudflare_module npm run build`.
Needs Node >= 20.19.

## Cloudflare D1

DB `sonic-level-creator` (primary WEUR), binding `DB`. `wrangler.toml` is the
source of truth — Nitro's `cloudflare_module` build merges it automatically
(see `.output/server/wrangler.json`).

| Command                                                            | What it does              |
| ------------------------------------------------------------------ | ------------------------- |
| `npx wrangler d1 execute sonic-level-creator --remote --command …` | Run SQL on remote primary |
| `npx wrangler d1 info sonic-level-creator`                         | Size, counters, replica mode |

Read replication is enabled per-database (dashboard: D1 > db > Settings) at
no extra cost; replicas only serve reads via the Sessions API
(`env.DB.withSession(...)`) in deployed Workers — plain queries always hit
the primary. No replicas exist locally; dev against remote or miniflare.
`server/utils/replica.ts` owns the plumbing: `getReplicaDb(event)` for
read-only routes (public listings + counts, reports queue, My Levels,
editor loads, `/play/:id` + gateway published reads, session lookups),
with single-row lookups retrying on the primary after a replica miss
(guests never retry — junk probes stop at the replica). Freshness-sensitive
paths stay primary (all writes, write-flow pre-selects, mod-review
fallbacks). Every mutating handler pins a fresh bookmark
(`pinFreshBookmark`, +1 `SELECT 1` on the edge, no-op locally) chained via
the `d1-bookmark` cookie, so the redirect/fetch after a write observes it.

## Auth (Better Auth + Drizzle + Argon2id)

- `server/auth/config.ts` — per-request `betterAuth()` (username plugin,
  custom Argon2id hasher, 7d server-side sessions). D1 on Workers via
  `drizzle-orm/d1`, local `./data/auth.db` (gitignored) via better-sqlite3.
- `server/auth/argon2.ts` — thin wrapper over `argon2-wasm-edge`; WASM
  arrives via `?module` imports (real Modules — the only Workers-legal
  path). Params: m=8192, t=2, p=1 (~40ms hash on workerd; needs Paid CPU).
- `server/db/schema.ts` + `drizzle/` migrations — `user/session/account/`
  `verification` tables; every hot lookup indexed (username/email/token
  unique, FK + identifier indexes). Apply: `wrangler d1 migrations apply
  sonic-level-creator --local|--remote`. Never hand-edit applied migrations.
- Forms POST to `/member/signin|signup` (server-side API calls, cookies +
  redirects, `formError` re-render). Raw Better Auth endpoints at
  `/api/auth/*` are allowlisted to `get-session`, `sign-out`, `ok`; all
  else 404s (sign-in/up would skip Turnstile, `update-user` allowed
  spoofing `displayUsername`). Password changes revoke other sessions. Secrets: `BETTER_AUTH_SECRET` via `wrangler pages secret
  put` (+ `BETTER_AUTH_URL` env var); local dev falls back to an insecure
  default — never deploy it.
- Moderators: `user.role = 'moderator'` (default `'user'`, migration
  `0005`). Role is output-only (`additionalFields … input: false`), so
  sign-up can never self-promote — promote via SQL only, e.g.
  `wrangler d1 execute sonic-level-creator --remote --command "UPDATE user
  SET role='moderator' WHERE username='…'";`. Mods get rename/delete
  buttons on All Levels + Levels-by-X and the POST endpoints enforce it
  server-side (`levelWhereForUser`; stock `2914` excluded even for mods).
- Reports: `report` table (migration `0006`, one open row per
  reporter×level) + `POST /api/levels/:id/report` (signed-in only, pretty
  URL called by `public/js/report.js`). Mod-only `/editors/reports` queue
  (guests bounce, non-mods 404) with Play/Rename/Delete/Dismiss per level;
  All Levels shows a Review Reports link to mods.

## Turnstile (Cloudflare bot check on sign-in/up)

- Widget (`server/templates/signin|signup.html`, `data-action` = signin /
  signup) + `server/utils/turnstile.ts` `verifyTurnstile()` (siteverify,
  fails closed, 0 SQL). Requires success + echoed action + allowlisted
  hostname; test secrets bypass action/hostname via
  `metadata.result_with_testing_key` — never deploy a test secret.
- Sitekey is per-request (`getTurnstileSitekey`): `TURNSTILE_SITEKEY` env
  binding, else the local always-pass test key. Prod vars in `wrangler.toml` (`[vars]`
  `TURNSTILE_SITEKEY` + `TURNSTILE_HOSTNAMES`); secret via
  `wrangler pages secret put TURNSTILE_SECRET` (never in the toml).
- Local: `.dev.vars` (wrangler) + `.env` (nitro dev, gitignored) default
  to the always-passes test pair when unset. Swap in the real secret +
  sitekey to test the production widget on localhost.

## Workflow

Editor sources (`ts/`, entry `ts/main.ts`):

| Folder         | Contents                                                        |
| -------------- | --------------------------------------------------------------- |
| `core/`        | shared state `S`, shadow-DOM query helpers, timing logs         |
| `level/`       | format/object defs, placement rules, validation + CSV, load/save/share |
| `render/`      | canvas drawing, ghost, sprite part data + sprite painting       |
| `input/`       | canvas mouse/keyboard, palette drag-drop, button wiring         |
| `ui/`          | `editor.html`/`.css`, tray thumbnails + tooltips, popups, start screens, viewport/zoom, mobile gate |
| `playtest/`    | background Ruffle test player + fullscreen fit                  |

Keep import order in `main.ts` stable — esbuild evaluates modules in
import order, and a few modules have load-time side effects.

After editing any `ts/**/*.ts` file, run `npm run build:editor`, then
`npm run lint`. The bundle must always be a strict reflection of the `ts/`
sources — never hand-edit `editor.js`. Rebuild Nitro after `server/` changes.
Kept `public/js/`: swfobject, shadedborder, events (RUZEE chrome), ticker,
report, feedback, notifications. Archive ad/analytics/dead scripts were
deleted (git history preserves them).
