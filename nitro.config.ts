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
  routeRules: {
    // Transitional: PHP endpoints still run under `php -S public` on :8000
    // until they are ported to server/api/. Also keeps .php source out of
    // static serving. (amfphp/gateway.php is natively ported — no proxy.)
    "/ajax/**": { proxy: "http://127.0.0.1:8000/ajax/**" },
    "/editors/save.php": { proxy: "http://127.0.0.1:8000/editors/save.php" },
  },
});
