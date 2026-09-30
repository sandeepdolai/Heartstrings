/**
 * Derive prisma/schema.cloudflare.prisma from prisma/schema.prisma and
 * generate the Cloudflare-Workers variant of Prisma Client into
 * src/generated/prisma-cf.
 *
 * Why two clients: the local dev client (prisma-client-js generator) loads
 * the native query engine, which works under plain Node but can never load
 * on workerd; the cloudflare-runtime client (prisma-client generator,
 * runtime="cloudflare") loads its WASM query engine via wrangler's
 * `*.wasm?module` import syntax, which works in the deployed Worker bundle
 * but not under webpack in `next dev`. Both variants are generated from the
 * SAME schema (only the generator block is swapped), so the models can
 * never drift. Run via postinstall so every install regenerates both.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "prisma", "schema.prisma");
const variantPath = join(root, "prisma", "schema.cloudflare.prisma");

const CF_GENERATOR = `// AUTO-DERIVED from schema.prisma by scripts/gen-cf-client.mjs — do not edit.
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma-cf"
  runtime  = "cloudflare"
}`;

const schema = readFileSync(schemaPath, "utf8");
const generatorRe = /generator client \{[^}]*\}/;
if (!generatorRe.test(schema)) {
  console.error("[gen-cf-client] could not find the generator block in schema.prisma");
  process.exit(1);
}
writeFileSync(variantPath, schema.replace(generatorRe, CF_GENERATOR));

const prismaBin = join(root, "node_modules", ".bin", "prisma");
execSync(`"${prismaBin}" generate --schema "${variantPath}"`, {
  cwd: root,
  stdio: "inherit",
});
console.log("[gen-cf-client] cloudflare client generated → src/generated/prisma-cf");
