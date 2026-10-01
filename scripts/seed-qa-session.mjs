/** QA helper — seeds a local test user + session and prints the token. */
import { PrismaClient } from "../src/generated/prisma/index.js";
import { randomBytes } from "crypto";

const db = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/custom.db" } } });
const token = randomBytes(32).toString("hex");
let user = await db.user.findUnique({ where: { email: "qa@paperstring.test" } });
if (!user) {
  user = await db.user.create({
    data: { email: "qa@paperstring.test", name: "Quinn Assurer", passwordHash: null },
  });
  console.error("created user " + user.id);
}
const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
await db.session.create({ data: { token, userId: user.id, expiresAt } });
console.log(token);
await db.$disconnect();
