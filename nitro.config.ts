// Nitro server: SSR pages (Eta templates) + static public/ docroot.
// Deploy: default `node_server`; Workers via NITRO_PRESET=cloudflare_module.
import { defineConfig } from "nitro";
import { collectFunctionRoutes } from "./build/pages-routes";

export default defineConfig({
  serverDir: "server",
  // Precompress public assets at build time (gzip + brotli). Runtime
  // on-the-fly brotli of multi-MB binaries costs seconds of CPU per
  // request (measured 7.6s for the 1.4MB spritesheet); prebuilt variants
  // are served directly with zero overhead.
  compressPublicAssets: { gzip: true, brotli: true },
  cloudflare: {
    pages: {
      // Fully-matched function routes only. The default `/*` include lets
      // scanner junk (/.env, /.git/…) invoke the worker per probe; with an
      // explicit list those fall through to static 404s for free.
      routes: {
        include: collectFunctionRoutes(),
        exclude: [],
      },
    },
  },
  // Baseline hardening headers on every response (static + SSR). No CSP:
  // the archive pages run inline scripts/SWF embeds by design, so a policy
  // tight enough to matter would break the player; XSS is handled by
  // escaping at the render layer instead (see server/utils/page.ts).
  routeRules: {
    "/**": {
      headers: {
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    },
  },
  // Dev-only: nitro dev pipes statics through on-the-fly brotli at max
  // quality when the client accepts it (~8s for the spritesheet, for a 5%
  // saving). Browsers always accept it, so strip the header in dev and
  // serve identity over loopback (ms). Production is unaffected: it serves
  // prebuilt .br/.gz variants with zero runtime cost.
  devHandlers: [
    {
      route: "/**",
      middleware: true,
      handler: (event: any) => {
        event.req.headers.delete("accept-encoding");
      },
    },
  ],
});
