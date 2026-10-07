import type { Express } from "express";
import { createPublicRouter } from "./public-routes";
import { createAdminRouter } from "./admin-routes";
import { handleScheduledScan } from "./scheduled";

export function registerGetMchongoRoutes(app: Express) {
  app.use("/api/gm", createPublicRouter());
  app.use("/api/gm/admin", createAdminRouter());
  app.post("/api/scheduled/get-mchongo-sources", handleScheduledScan);
}
