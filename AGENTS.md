# AGENTS.md

## Stack

Nitro 3 server (`nitro.config.ts`, `server/`) + Eta templates + esbuild editor
bundle. Web document root is `public/` (Nitro serves it as static);
`/` and `/editors/` are SSR routes, everything else static.

- `server/templates/` — hand-written Eta `.html` templates (`<%= %>` escaped,
  `<%~ %>` raw for trusted markup only), inlined via `with { type: "text" }`.
  No fs reads (Workers-safe).
- `server/routes/index.get.ts` → game page, `server/routes/editors/index.get.ts`
  → editor page. Query stubs `?user= ?session= ?levelid= ?territory= ?title=`
  until auth lands (see `server/utils/page.ts`).
- `server/middleware/canonical.ts` — `/editors` → `/editors/` 301.
- PHP endpoints (`/amfphp/**`, `/ajax/**`, `/editors/save.php`) are proxied to
  `php -S public` on :8000 until ported to `server/api/`.

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Nitro dev server (needs `php -S public` on :8000 for PHP) |
| `npm run build`      | Editor bundle + `nitro build` (preset `node_server`)      |
| `npm run build:editor` | Bundles `ts/main.ts` → `public/editors/assets/editor.js` |
| `npm run lint`       | `node --check` on the compiled `editor.js`                |
| `npm run serve`      | Run the production build (`.output/server/index.mjs`)     |

> `dev` strips `Accept-Encoding` via a dev-only middleware (nitro dev
> would otherwise brotli statics on the fly at max quality — ~8s for the
> spritesheet). Production serves prebuilt `.br`/`.gz` variants instead.

Workers deploy: `NITRO_PRESET=cloudflare_module npm run build`.
Needs Node >= 20.19.

## Workflow

After editing any `ts/*.ts` file, run `npm run build:editor`, then
`npm run lint`. The bundle must always be a strict reflection of the `ts/`
sources — never hand-edit `editor.js`. Rebuild Nitro after `server/` changes.
Kept `public/js/`: swfobject, shadedborder, events (RUZEE chrome), ticker,
report, feedback, notifications. Archive ad/analytics/dead scripts were
deleted (git history preserves them).
