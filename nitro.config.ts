// Nitro server: SSR pages (Eta-syntax templates) + static public/ docroot.
// Deploy: default `node_server`; Workers via NITRO_PRESET=cloudflare_module.
import { defineConfig } from "nitro";
import { collectFunctionRoutes } from "./build/pages-routes";

export default defineConfig({
  serverDir: "server",
  // Runtime brotli of multi-MB binaries costs seconds of CPU per request
  // (7.6s for the spritesheet); prebuilt variants cost nothing.
  compressPublicAssets: { gzip: true, brotli: true },
  cloudflare: {
    pages: {
      // Explicit list instead of `/*`: scanner junk (/.env, /.git/…) falls
      // through to free static 404s instead of invoking the worker.
      routes: {
        include: collectFunctionRoutes(),
        exclude: [],
      },
    },
  },
  // Hardening headers on every response (static + SSR):
  // - No framing; frame-src exists only for Turnstile's challenge iframe.
  // - 'unsafe-eval' is required by Ruffle (no eval-free build). Scripts stay
  //   host-allowlisted and output is escaped in server/utils/page/render.ts.
  // - Permissions-Policy allows only fullscreen + autoplay on self.
  // - No COEP (breaks Ruffle chunk loading); HSTS belongs on the edge.
  routeRules: {
    "/**": {
      headers: {
        "content-security-policy": [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://unpkg.com https://challenges.cloudflare.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          // Ruffle synthesizes game audio as data: URLs at runtime.
          "media-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self' https://unpkg.com",
          // Same-origin SWFs are embedded as plugin data for Ruffle.
          "object-src 'self'",
          // Ruffle runs audio/decoding in blob: workers (always same-origin).
          "worker-src 'self' blob:",
          "frame-src https://challenges.cloudflare.com",
          "form-action 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        // 0 disables the legacy XSS auditor, which itself introduced XSS.
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
  // nitro dev brotlis statics on the fly at max quality (~8s for the
  // spritesheet). Serve identity over loopback instead.
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
