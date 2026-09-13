# AGENTS.md

## Build & Lint

The editor is a single-file IIFE bundle built from `ts/` sources via esbuild.

| Command         | What it does                                    |
| --------------- | ----------------------------------------------- |
| `npm run build` | Bundles `ts/main.ts` → `editors/assets/editor.js` |
| `npm run lint`  | `node --check` on the compiled `editor.js`       |

Source is TypeScript in `ts/`; the compiled bundle is `editors/assets/editor.js`,
loaded as a plain `<script>` (no module type) from `editors/index.html:213`.

## Workflow

After editing any `ts/*.ts` file, run `npm run build` to regenerate the bundle,
then `npm run lint` to verify syntax. The bundle must always be a strict
reflection of the `ts/` sources — never hand-edit `editor.js`.
