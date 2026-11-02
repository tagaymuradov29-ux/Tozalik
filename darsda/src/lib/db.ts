import postgres from "postgres";

const g = globalThis as unknown as { __sql?: postgres.Sql };

export const sql =
  g.__sql ??
  postgres(process.env.DATABASE_URL || "postgres://localhost/platforma", {
    max: process.env.NODE_ENV === "production" ? 3 : 10,
    idle_timeout: 20,
    prepare: false,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") g.__sql = sql;
