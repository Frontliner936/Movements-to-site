import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { serveStatic, setupVite } from "./vite";
import { registerGetMchongoRoutes } from "../getmchongo/router";
import { registerJobShareMetadata } from "../getmchongo/share-meta";
import { serveLocalStorage } from "../getmchongo/local-storage";
import { startLocalScanScheduler } from "../getmchongo/local-scheduler";

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Permit two bounded files for this route; keep the lower request cap for all other endpoints.
  app.use("/api/gm/member/cv-check", express.json({ limit: "15mb" }));
  app.use(express.json({ limit: "7mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/manus-storage/*", serveLocalStorage); // Legacy URL prefix retained for existing database records.
  registerGetMchongoRoutes(app);
  registerJobShareMetadata(app);
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  startLocalScanScheduler();
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
