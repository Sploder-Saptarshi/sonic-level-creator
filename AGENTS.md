# AGENTS.md

## Stack

Nitro 3 server (`nitro.config.ts`, `server/`) + Eta templates + esbuild editor
bundle. Web document root is `public/` (Nitro serves it as static);
`/` and `/editors/` are SSR routes, everything else static.

- `server/templates/` — hand-written Eta-syntax `.html` templates
  (`<%= %>` escaped, `<%~ %>` raw for trusted markup only), inlined via
  `with { type: "text" }` and rendered by a minimal eval-free interpolator
  in `server/utils/page.ts` (the Eta package itself was dropped: its
  `new Function` compile is banned on Workers). No fs reads (Workers-safe).
- `server/routes/index.get.ts` → game page, `server/routes/editors/index.get.ts`
  → editor page. Query stubs `?user= ?session= ?levelid= ?territory= ?title=`
  until auth lands (see `server/utils/page.ts`).
- PHP backend removed: `/amfphp/gateway.php` is natively ported to
  `server/routes/amfphp/gateway.php.post.ts`; dead `/ajax/**` +
  `/editors/save.php` scripts deleted (ticker/report/feedback call sites
  in `public/js/` are inert until ported).

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Nitro dev server (no PHP needed)                        |
| `npm run build`      | Editor bundle + `nitro build` (preset `node_server`)      |
| `npm run build:editor` | Bundles `ts/main.ts` → `public/editors/assets/editor.js` |
| `npm run lint`       | `node --check` on the compiled `editor.js`                |
| `npm run serve`      | Run the production build (`.output/server/index.mjs`)     |
| `npm run deploy:pages` | Build `cloudflare_pages` preset + deploy `dist/` to `sonicrelvl.pages.dev` |

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
  `/api/auth/*`. Secrets: `BETTER_AUTH_SECRET` via `wrangler pages secret
  put` (+ `BETTER_AUTH_URL` env var); local dev falls back to an insecure
  default — never deploy it.

## Workflow

After editing any `ts/*.ts` file, run `npm run build:editor`, then
`npm run lint`. The bundle must always be a strict reflection of the `ts/`
sources — never hand-edit `editor.js`. Rebuild Nitro after `server/` changes.
Kept `public/js/`: swfobject, shadedborder, events (RUZEE chrome), ticker,
report, feedback, notifications. Archive ad/analytics/dead scripts were
deleted (git history preserves them).
