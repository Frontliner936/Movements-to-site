import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let geoTableReady = false;
let geoTableInit: Promise<void> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Creates the additive visitor-location aggregate table on demand. */
export async function ensureGeoVisitorTotalsTable(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  if (geoTableReady) return true;
  if (!geoTableInit) {
    geoTableInit = (async () => {
      try {
        await db.execute(sql`CREATE TABLE IF NOT EXISTS
          gm_geo_visitor_totals (
            id int AUTO_INCREMENT NOT NULL,
            country_code varchar(2) NOT NULL,
            country varchar(100) NOT NULL,
            region_code varchar(32) NOT NULL DEFAULT '',
            region varchar(120) NOT NULL DEFAULT '',
            total int NOT NULL DEFAULT 0,
            updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT gm_geo_visitor_totals_id PRIMARY KEY (id),
            CONSTRAINT gm_geo_visitor_region_unique UNIQUE (country_code, region_code)
          )`);
        geoTableReady = true;
      } catch (error) {
        geoTableInit = null;
        console.warn("[Database] Could not initialize visitor-location totals table:", error);
      }
    })();
  }
  await geoTableInit;
  return geoTableReady;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
