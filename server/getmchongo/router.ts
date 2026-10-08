import type { Express } from "express";
import { createPublicRouter } from "./public-routes";
import { createAdminRouter } from "./admin-routes";

export function registerGetMchongoRoutes(app: Express) {
  app.use("/api/gm", createPublicRouter());
  app.use("/api/gm/admin", createAdminRouter());
}
