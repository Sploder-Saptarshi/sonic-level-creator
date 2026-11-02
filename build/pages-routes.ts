// Build-time only. Generates the Cloudflare Pages `_routes.json` include
// list by mirroring Nitro's file-based route mapping (Nitro exposes no
// public scanner API):
//
//   server/routes/index.get.ts          -> /
//   server/routes/member/signin.post.ts -> /member/signin (+ trailing-slash twin)
//   server/api/levels/[id].get.ts       -> /api/levels/*
//   server/api/auth/[...all].ts         -> /api/auth/*
//
// Method suffixes are dropped; dynamic and catch-all segments become `*`.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HANDLER_EXT = /\.(get|post|put|delete|patch|head|options|ts|mjs|js)$/;

function toRoute(prefix: string, file: string): string {
  // gateway.php.post.ts -> gateway.php (keeps the URL's own extension).
  const name = file
    .replace(/\.(get|post|put|delete|patch|head|options)\.([^.]+)$/, "")
    .replace(/\.(ts|js|mjs|cjs)$/, "");
  const segs = `${prefix}/${name}`
    .split("/")
    .filter((s) => s && s !== "index")
    .map((s) => (/^\[.+\]$/.test(s) ? "*" : s));
  return `/${segs.join("/")}`;
}

function addRoute(route: string, out: Set<string>) {
  out.add(route);
  if (route !== "/" && !route.endsWith("/*")) out.add(`${route}/`);
}

function scan(dir: string, prefix: string, out: Set<string>) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) scan(p, `${prefix}/${e}`, out);
    else if (HANDLER_EXT.test(e)) addRoute(toRoute(prefix, e), out);
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
  // _routes.json rejects overlapping includes (e.g. /api/levels/*/publish
  // under /api/levels/*).
  const wilds = [...out].filter((r) => r.endsWith("/*"));
  const covered = (r: string) =>
    wilds.some((w) => w !== r && r.startsWith(w.slice(0, -1)));
  return [...out].filter((r) => !covered(r)).sort();
}
