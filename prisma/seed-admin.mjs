import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

async function main() {
  loadEnv();

  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !email || !password) {
    throw new Error("ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required.");
  }

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        username: username.toLowerCase(),
        passwordHash: hashPassword(password),
        role: "ADMIN",
      },
      create: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        role: "ADMIN",
      },
    });

    console.log(`Admin user ready: ${user.username} <${user.email}>`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
