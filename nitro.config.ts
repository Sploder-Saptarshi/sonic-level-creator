import { execSync } from "node:child_process";
import { defineConfig } from "nitro";
import { collectFunctionRoutes } from "./build/pages-routes";

// full SHA of the commit being built ("" when unknown); CI env wins over git
function commitSha(): string {
  let sha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "";
  if (!sha) {
    try {
      sha = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      sha = "";
    }
  }
  return /^[0-9a-f]{40}$/.test(sha) ? sha : "";
}

export default defineConfig({
  serverDir: "server",
  replace: {
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
  // on-the-fly brotli of the spritesheet took ~8s
  compressPublicAssets: { gzip: true, brotli: true },
  cloudflare: {
    pages: {
      // explicit list so scanner junk (/.env, /.git) never invokes the worker
      routes: {
        include: collectFunctionRoutes(),
        exclude: [],
      },
    },
  },
  // Ruffle needs 'unsafe-eval', data: audio and blob: workers. No COEP: it
  // breaks Ruffle's chunk loading.
  routeRules: {
    "/**": {
      headers: {
        "content-security-policy": [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://unpkg.com https://challenges.cloudflare.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "media-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self' https://unpkg.com",
          "object-src 'self'",
          "worker-src 'self' blob:",
          "frame-src https://challenges.cloudflare.com",
          "form-action 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
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
  // nitro dev would brotli statics on every request
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
