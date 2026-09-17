// build/pages-routes.ts — build-time helper (never bundled, never shipped).
// Generates the Cloudflare Pages `_routes.json` include list from the
// filesystem, mirroring Nitro's own route mapping:
//
//   server/routes/index.get.ts        -> /
//   server/routes/editors/index.get.ts -> /editors (+ trailing-slash twin)
//   server/routes/member/signin.post.ts -> /member/signin (+ twin)
//   server/api/auth/[...all].ts       -> /api/auth/*
//
// HTTP method suffixes are ignored (one path serves all methods); dynamic
// `[param]` segments become `:param`, catch-all `[...x]` becomes `*`.
// (Nitro has no public scanner API — its scanner lives in builder
// internals — so this intentionally duplicates the dozen lines of mapping.)
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HANDLER_EXT = /\.(get|post|put|delete|patch|head|options|ts|mjs|js)$/;

function toRoute(prefix: string, file: string): string | null {
  const name = file
    .replace(/\.(get|post|put|delete|patch|head|options)\.[^.]+$/, "")
    .replace(/\.[^.]+$/, "");
  const segs: string[] = [];
  for (const s of `${prefix}/${name}`.split("/").filter(Boolean)) {
    if (s === "index") continue;
    if (/^\[\.\.\..+\]$/.test(s)) {
      segs.push("*");
      continue;
    }
    if (/^\[.+\]$/.test(s)) {
      segs.push(`:${s.slice(1, -1)}`);
      continue;
    }
    segs.push(s);
  }
  return `/${segs.join("/")}`;
}

function scan(dir: string, prefix: string, out: Set<string>) {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      scan(p, `${prefix}/${e}`, out);
      continue;
    }
    if (!HANDLER_EXT.test(e)) continue;
    const route = toRoute(prefix, e);
    if (route === null) continue;
    if (route.endsWith("/*")) {
      out.add(route);
      continue;
    }
    out.add(route === "" ? "/" : route);
    if (route !== "/") out.add(`${route}/`);
  }
}

export function collectFunctionRoutes(
  dirs: Record<string, string> = {
    "server/routes": "",
    "server/api": "/api",
  },
): string[] {
  const out = new Set<string>();
  for (const [dir, prefix] of Object.entries(dirs)) scan(dir, prefix, out);
  return [...out].sort();
}
