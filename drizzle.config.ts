import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./db/migrations",
  schema: "./app/db/schema.ts",
  dialect: "sqlite",
});
