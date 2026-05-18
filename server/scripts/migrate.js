import "../src/env.js";
import mysql from "mysql2/promise";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const requiredVars = ["DB_HOST", "DB_USER", "DB_NAME"];
const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../sql/migrations");

const run = async () => {
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    for (const file of migrationFiles) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await connection.query(sql);
      console.log(`Migration applied: ${file}`);
    }
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error("Migration failed", error);
  process.exit(1);
});
