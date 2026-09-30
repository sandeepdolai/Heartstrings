import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare adapter configuration.
 * The defaults target a standard full-stack Next.js app: static assets are
 * served via Workers Static Assets, ISR/cache overrides default to the
 * no-op implementations (this app is a client-side SPA + route handlers).
 */
export default defineCloudflareConfig();
