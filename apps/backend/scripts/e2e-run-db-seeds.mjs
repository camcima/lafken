/* eslint-disable no-console, no-process-env */
// @ts-check
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { Client } from "pg";

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
dotenvExpand.expand(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  dotenv.config({
    path: [".env.test"],
    override: false,
    quiet: true,
  }),
);

async function initDatabaseConnection() {
  const connectionString = process.env.DATABASE_URL;
  console.info("🔌 Initializing database connection");
  const client = new Client({
    connectionString,
    keepAlive: false,
  });
  await client.connect();
  console.info("✅ Database connection initialized");
  return client;
}

/**
 * Assumes that there is a directory '<CWD>/test/e2e/db-seeds' with the files ending
 * with '.sql' and run those SQL quires in a single database transaction.
 * @param {Client} client - The database client to use.
 */
async function runDatabaseSeeds(client) {
  const seedsDirectory = join(process.cwd(), "test", "e2e", "db-seeds");

  /**
   * All files in the seeds directory, sorted by name to ensure that the seeds
   * are run in the correct order
   */
  const files = readdirSync(seedsDirectory, {
    withFileTypes: true,
    recursive: false,
  })
    .filter((file) => file.isFile() && file.name.endsWith(".sql"))
    .sort((a, b) => a.name.localeCompare(b.name));

  try {
    await client.query("BEGIN");
    for (const file of files) {
      const seedFileAbsFile = join(file.parentPath, file.name);
      const sql = readFileSync(seedFileAbsFile, "utf8");
      console.info(`Running seed: ${file.name}`);
      await client.query(sql);
    }
    await client.query("COMMIT");
  } catch (err) {
    console.error(`❌ Error running database seeds:`, err);
    await client.query("ROLLBACK");
    throw err;
  }
}

async function main() {
  const dbClient = await initDatabaseConnection();
  console.warn("🌱 Running database seeds...");
  await runDatabaseSeeds(dbClient);
  console.warn("✅ Database seeds run successfully");
  await dbClient.end();
}

void main();
