import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import { DIST_DIR, IS_DEV, ROOT_DIR } from "./config/paths";

export async function setupFrontend(app: Express) {
  if (IS_DEV) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      appType: "custom",
      server: {
        middlewareMode: true,
      },
    });

    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.path.startsWith("/api")) return next();

      try {
        const indexPath = path.join(ROOT_DIR, "index.html");
        const template = fs.readFileSync(indexPath, "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
    return;
  }

  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();

    const indexPath = path.join(DIST_DIR, "index.html");
    if (!fs.existsSync(indexPath)) {
      return res.status(503).send("前端尚未构建。请先运行 npm run build，或使用 npm start 启动。");
    }

    return res.sendFile(indexPath);
  });
}
