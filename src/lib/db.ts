import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * The app-wide Prisma client.
 *
 * The concrete client is installed lazily — inside the request context —
 * by ensureDb() from @/lib/db-init, which every API route handler awaits
 * as its first statement:
 *   • on Cloudflare (OpenNext worker): a PrismaClient wired to the D1
 *     binding via @prisma/adapter-d1 (the binding is only readable while
 *     a request is being served — never at module scope),
 *   • in local `next dev`: the classic SQLite engine + DATABASE_URL.
 *
 * Until then, this proxy defers every property access to the installed
 * client, so every `import { db } from "@/lib/db"` keeps working unchanged
 * (a module-scope constructor would throw on the worker, where
 * DATABASE_URL doesn't exist).
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = globalForPrisma.prisma
    if (!client) {
      throw new Error(
        'Prisma client not initialized — the route handler must `await ensureDb()` (from "@/lib/db-init") before its first db access.'
      )
    }
    const value = Reflect.get(client as object, prop, client)
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value
  },
})

/** Install the process-wide client (idempotent). */
export function setPrismaClient(client: PrismaClient): void {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = client
}
