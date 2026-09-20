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
  // Baseline hardening headers on every response (static + SSR).
  // Strict by design — every entry below was checked against what the app
  // actually uses (grep-verified, no guesswork):
  // - Framing is fully off (DENY + frame-ancestors 'none'): our markup has
  //   zero <iframe>s of its own. The single exception is frame-src for
  //   Turnstile, which injects its challenge iframe at runtime.
  // - No CSP `unsafe-eval`, but `wasm-unsafe-eval` IS required: Ruffle's
  //   emulation core is a WASM binary and browsers gate WASM compilation
  //   behind script-src. Inline scripts stay allowed ('unsafe-inline') —
  //   the archive markup is inline-script by design, so XSS stays handled
  //   at the render layer (see server/utils/page.ts), while CSP still
  //   bans foreign script hosts, plugins, <base> hijacks and exfil forms.
  // - Permissions-Policy disables every sensor/identity/capture API except
  //   fullscreen + autoplay on self (touch-fullscreen.js + game audio).
  // - No COEP (would risk Ruffle chunk loading) and no in-app HSTS (would
  //   also stamp localhost in dev) — HSTS belongs on the Cloudflare edge.
  routeRules: {
    "/**": {
      headers: {
        "content-security-policy": [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://unpkg.com https://challenges.cloudflare.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self' https://unpkg.com",
          // 'self', not 'none': the player embeds same-origin SWFs as
          // plugin data (Ruffle boots them) — remote plugin content stays
          // banned. In modern browsers nothing but Ruffle consumes this.
          "object-src 'self'",
          "frame-src https://challenges.cloudflare.com",
          "form-action 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
        // NOTE: no `x-content-type-options: nosniff` — it was breaking
        // content (some served asset carries a MIME the browser won't
        // execute/apply under nosniff). Keep it off until the offending
        // asset is identified and served with its correct type.
        "x-frame-options": "DENY",
        // Deliberately 0, not "1; mode=block": the legacy XSS auditor is
        // deprecated and enabling it can CREATE vulnerabilities in old
        // browsers (auditor-induced XSS). Real XSS prevention is the CSP
        // above (script-src allowlist, object-src 'none', base-uri) plus
        // escaping at the render layer — this just switches the buggy
        // auditor off where it still exists.
        "x-xss-protection": "0",
        "referrer-policy": "strict-origin-when-cross-origin",
        "cross-origin-resource-policy": "same-origin",
        "cross-origin-opener-policy": "same-origin",
        "origin-agent-cluster": "?1",
        "x-permitted-cross-domain-policy": "none",
        "x-dns-prefetch-control": "off",
        "permissions-policy": [
          "accelerometer=()",
          "ambient-light-sensor=()",
          "autoplay=(self)",
          "battery=()",
          "bluetooth=()",
          "camera=()",
          "display-capture=()",
          "document-domain=()",
          "encrypted-media=()",
          "fullscreen=(self)",
          "geolocation=()",
          "gyroscope=()",
          "interest-cohort=()",
          "magnetometer=()",
          "microphone=()",
          "midi=()",
          "payment=()",
          "picture-in-picture=()",
          "publickey-credentials-create=()",
          "publickey-credentials-get=()",
          "screen-wake-lock=()",
          "sync-xhr=()",
          "usb=()",
          "web-share=()",
          "xr-spatial-tracking=()",
        ].join(", "),
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
