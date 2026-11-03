# Sonic Level Creator

A revival of the Sonic Level Creator: build Sonic levels in the browser, save
them to your account, and play them. The game runs in the browser through
[Ruffle](https://ruffle.rs), so no Flash plugin is needed.

Live at <https://sonicrelvl.pages.dev>.

## What's in here

- `ts/`: the level editor (TypeScript, bundled with esbuild).
- `server/`: the Nitro server. It renders the pages, handles sign-in and
  accounts (Better Auth), stores levels in Cloudflare D1 (Drizzle), and
  implements the old AMF gateway the game talks to.
- `public/`: static files: the game SWFs, images, CSS and scripts.
- `drizzle/`: database migrations.

## Running it locally

Built and tested with Node 26.12.1.

```sh
npm install
npm run build:editor
npm run dev
```

The editor bundle (`public/editors/assets/editor.js`) is build output and is
not committed, so run `build:editor` first, and again after changing anything
in `ts/`.

Accounts are stored in `./data/auth.db` in development, and Turnstile uses
Cloudflare's always-pass test keys unless you set your own in `.env`.

## Scripts

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Dev server                                    |
| `npm run build`        | Minified editor bundle and a Node server build |
| `npm run serve`        | Run the production build                      |
| `npm run lint`         | Type-check with `tsc`                         |
| `npm run deploy:pages` | Build and deploy to Cloudflare Pages          |

## License

The code is AGPL-3.0-or-later. The game assets in `public/` belong to PlaySEGA,
Mediatonic and SEGA and are not covered by it. See [LICENSE](LICENSE).
