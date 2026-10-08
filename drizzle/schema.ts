import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, uniqueIndex } from "drizzle-orm/mysql-core";

/** Base Manus account table, retained for the starter OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const companies = mysqlTable("gm_companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 240 }).notNull(),
  slug: varchar("slug", { length: 280 }).notNull().unique(),
  description: text("description"),
  logoUrl: varchar("logo_url", { length: 2048 }),
  websiteUrl: varchar("website_url", { length: 2048 }),
  location: varchar("location", { length: 240 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const sources = mysqlTable("gm_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 240 }).notNull(),
  type: mysqlEnum("type", ["rss", "json", "career", "scraper"]).notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  settings: text("settings"),
  lastRunAt: timestamp("last_run_at"),
  lastRunError: text("last_run_error"),
  lastRunCount: int("last_run_count").default(0).notNull(),
  totalJobsFound: int("total_jobs_found").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const jobs = mysqlTable("gm_jobs", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  companyId: int("company_id"),
  companyName: varchar("company_name", { length: 240 }),
  companyDescription: text("company_description"),
  companyLogoUrl: varchar("company_logo_url", { length: 2048 }),
  companyWebsiteUrl: varchar("company_website_url", { length: 2048 }),
  category: varchar("category", { length: 120 }),
  location: varchar("location", { length: 240 }),
  deadline: varchar("deadline", { length: 240 }),
  description: text("description"),
  responsibilities: text("responsibilities"),
  qualifications: text("qualifications"),
  howToApply: text("how_to_apply"),
  applicationUrl: varchar("application_url", { length: 2048 }),
  imageUrl: varchar("image_url", { length: 2048 }),
  sourceUrl: varchar("source_url", { length: 2048 }),
  sourceId: int("source_id"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const pendingJobs = mysqlTable("gm_pending_jobs", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("source_id").notNull(),
  sourceName: varchar("source_name", { length: 240 }).notNull(),
  sourceFingerprint: varchar("source_fingerprint", { length: 64 }).notNull().unique(),
  sourceUrl: varchar("source_url", { length: 2048 }),
  title: varchar("title", { length: 300 }).notNull(),
  companyName: varchar("company_name", { length: 240 }),
  companyDescription: text("company_description"),
  companyLogoUrl: varchar("company_logo_url", { length: 2048 }),
  companyWebsiteUrl: varchar("company_website_url", { length: 2048 }),
  category: varchar("category", { length: 120 }),
  location: varchar("location", { length: 240 }),
  deadline: varchar("deadline", { length: 240 }),
  description: text("description"),
  responsibilities: text("responsibilities"),
  qualifications: text("qualifications"),
  howToApply: text("how_to_apply"),
  applicationUrl: varchar("application_url", { length: 2048 }),
  imageUrl: varchar("image_url", { length: 2048 }),
  rawContext: text("raw_context"),
  duplicateMatches: text("duplicate_matches"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const jobReactions = mysqlTable("gm_job_reactions", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("job_id").notNull(),
  visitorKey: varchar("visitor_key", { length: 64 }).notNull(),
  kind: mysqlEnum("kind", ["like", "save"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [uniqueIndex("gm_reaction_unique").on(table.jobId, table.visitorKey, table.kind)]);

export const scanSchedules = mysqlTable("gm_scan_schedules", {
  id: int("id").primaryKey(),
  heartbeatTaskUid: varchar("heartbeat_task_uid", { length: 80 }),
  cronExpression: varchar("cron_expression", { length: 120 }).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  lastRunAt: timestamp("last_run_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const jobViewers = mysqlTable("gm_job_viewers", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  visitorKey: varchar("visitor_key", { length: 64 }).notNull(),
  firstViewedAt: timestamp("first_viewed_at").defaultNow().notNull(),
  lastViewedAt: timestamp("last_viewed_at").defaultNow().notNull(),
}, table => [uniqueIndex("gm_job_viewer_unique").on(table.jobId, table.visitorKey)]);

export const contactMessages = mysqlTable("gm_contact_messages", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

/** Admin-managed announcements (interviews, events, ads, announced businesses). */
export const announcements = mysqlTable("gm_announcements", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  kind: mysqlEnum("kind", ["interview", "event", "ad", "business", "news"]).default("news").notNull(),
  body: text("body"),
  imageUrl: varchar("image_url", { length: 2048 }),
  imageCaption: varchar("image_caption", { length: 600 }),
  pdfUrl: varchar("pdf_url", { length: 2048 }),
  pdfName: varchar("pdf_name", { length: 240 }),
  linkUrl: varchar("link_url", { length: 2048 }),
  linkLabel: varchar("link_label", { length: 120 }),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
