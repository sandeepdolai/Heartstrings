import { PrismaClient as PrismaClientNode } from "@/generated/prisma/client";
// Cloudflare-Workers variant of the generated client: identical models,
// but its WASM query engine loads via wrangler's `*.wasm?module` import
// (see scripts/gen-cf-client.mjs) — only used on the deployed worker.
import { PrismaClient as PrismaClientWorkers } from "@/generated/prisma-cf/client";
import { setPrismaClient } from "@/lib/db";

/**
 * Structural slice of the Cloudflare D1 binding — everything the
 * @prisma/adapter-d1 constructor needs, without importing worker types.
 */
interface D1Like {
  prepare: (sql: string) => unknown;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientNode;
  psPrismaInit?: Promise<void>;
};

/**
 * Idempotently install the process-wide Prisma client. MUST be awaited at
 * the top of every API route handler (see db.ts for why) — it runs inside
 * the request context, where:
 *
 *   • on the deployed OpenNext worker, getCloudflareContext() finds the
 *     AsyncLocalStorage store the worker entry installs per request,
 *     giving access to the D1 binding → PrismaD1 driver adapter.
 *     (Context is NOT available at module/init time, which is why init
 *     is lazy.)
 *   • in plain local `next dev`, the accessor throws ("run
 *     initOpenNextCloudflareForDev…"), which is our cue to use the
 *     better-sqlite3 driver adapter against the local dev database —
 *     same queryCompiler client, same driver-adapter architecture as
 *     production. (The async accessor is deliberately NOT used: in a
 *     Node runtime it would try to spin up wrangler/miniflare.)
 */
export function ensureDb(): Promise<void> {
  if (globalForPrisma.prisma) return Promise.resolve();
  if (!globalForPrisma.psPrismaInit) {
    globalForPrisma.psPrismaInit = initPrisma().catch((err) => {
      // Allow a later request to retry after a transient failure.
      globalForPrisma.psPrismaInit = undefined;
      throw err;
    });
  }
  return globalForPrisma.psPrismaInit;
}

async function initPrisma(): Promise<void> {
  if (globalForPrisma.prisma) return;

  // 1) Cloudflare Workers path (OpenNext): D1 binding → driver adapter.
  //    Detected via the documented navigator.userAgent constant instead of
  //    a try/catch: if anything fails HERE on the worker it must surface as
  //    its real error (a silent fall-through used to route the worker into
  //    the better-sqlite3 branch below, whose bundled require("fs") then
  //    crashed with a misleading "Dynamic require of fs" per request).
  const onWorkers =
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers";
  if (onWorkers) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = getCloudflareContext() as
      | { env?: { DB?: D1Like } }
      | undefined;
    const d1 = cf?.env?.DB;
    if (!(d1 && typeof d1.prepare === "function")) {
      throw new Error(
        '[db-init] D1 binding "DB" is not available inside the request context'
      );
    }
    const { PrismaD1 } = await import("@prisma/adapter-d1");
    setPrismaClient(
      new PrismaClientWorkers({ adapter: new PrismaD1(d1 as never) })
    );
    return;
  }

  // 2) Local path: better-sqlite3 driver adapter on the dev database
  //    (DATABASE_URL is a file: URL pointing at the sandbox's SQLite file).
  //    The import specifier is intentionally non-literal (and flagged with
  //    webpackIgnore) so neither Turbopack nor esbuild can resolve it
  //    statically — the native better-sqlite3 module must never be traced
  //    into the worker bundle. At runtime on Node it resolves normally.
  const betterSqlite3Spec = "@prisma/adapter-better-sqlite3";
  const { PrismaBetterSqlite3 } = (await import(
    /* webpackIgnore: true */ betterSqlite3Spec
  )) as typeof import("@prisma/adapter-better-sqlite3");
  const url = process.env.DATABASE_URL ?? "file:./db/custom.db";
  setPrismaClient(
    new PrismaClientNode({
      adapter: new PrismaBetterSqlite3({ url }) as never,
    })
  );
}
