import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull(),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
  active: integer("active").notNull().default(1),
});

export const metrics = sqliteTable("metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  unit: text("unit"),
  goal: real("goal"),
  goalDirection: text("goal_direction"),
  weeklyTarget: integer("weekly_target"),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: integer("archived").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const metricEntries = sqliteTable(
  "metric_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    metricId: integer("metric_id").notNull().references(() => metrics.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    value: real("value").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("metric_entries_metric_date_idx").on(table.metricId, table.date),
  ]
);
