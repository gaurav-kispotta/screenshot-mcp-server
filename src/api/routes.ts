import express, { Request, Response, Router } from "express";
import { ScreenshotEngine } from "../screenshot/engine";
import { ImageProcessor } from "../screenshot/processor";
import { WindowManager } from "../window/manager";
import { AuditLogger } from "../utils/audit";
import { authenticateJWT } from "./middleware";

export function setupRoutes(
  app: express.Application,
  screenshotEngine: ScreenshotEngine,
  imageProcessor: ImageProcessor,
  windowManager: WindowManager,
  auditLogger: AuditLogger
): void {
  const router = Router();

  // Apply authentication to API routes
  // router.use(authenticateJWT);

  // API documentation
  router.get("/docs", (req: Request, res: Response) => {
    res.send("API Documentation - TODO");
  });

  // Window management routes
  router.get("/windows", async (req: Request, res: Response) => {
    try {
      const windows = await windowManager.listAllWindows();

      auditLogger.log(
        req.ip || "unknown",
        "list_windows",
        "/api/v1/windows",
        "success",
        { count: windows.length }
      );

      res.json({ success: true, data: windows });
    } catch (error) {
      auditLogger.log(
        req.ip || "unknown",
        "list_windows",
        "/api/v1/windows",
        "error",
        { error: (error as Error).message }
      );

      res.status(500).json({ success: false, error: "Failed to list windows" });
    }
  });

  router.get("/windows/active", async (req: Request, res: Response) => {
    try {
      const window = await windowManager.getActiveWindow();

      auditLogger.log(
        req.ip || "unknown",
        "get_active_window",
        "/api/v1/windows/active",
        window ? "success" : "not_found"
      );

      if (window) {
        res.json({ success: true, data: window });
      } else {
        res
          .status(404)
          .json({ success: false, error: "No active window found" });
      }
    } catch (error) {
      auditLogger.log(
        req.ip || "unknown",
        "get_active_window",
        "/api/v1/windows/active",
        "error",
        { error: (error as Error).message }
      );

      res
        .status(500)
        .json({ success: false, error: "Failed to get active window" });
    }
  });

  router.get("/windows/:id", async (req: Request, res: Response) => {
    try {
      const window = await windowManager.getWindowById(req.params.id);

      auditLogger.log(
        req.ip || "unknown",
        "get_window",
        `/api/v1/windows/${req.params.id}`,
        window ? "success" : "not_found"
      );

      if (window) {
        res.json({ success: true, data: window });
      } else {
        res.status(404).json({ success: false, error: "Window not found" });
      }
    } catch (error) {
      auditLogger.log(
        req.ip || "unknown",
        "get_window",
        `/api/v1/windows/${req.params.id}`,
        "error",
        { error: (error as Error).message }
      );

      res.status(500).json({ success: false, error: "Failed to get window" });
    }
  });

  router.get(
    "/applications/:appName/windows",
    async (req: Request, res: Response) => {
      try {
        const windows = await windowManager.getWindowsByApplication(
          req.params.appName
        );

        auditLogger.log(
          req.ip || "unknown",
          "get_app_windows",
          `/api/v1/applications/${req.params.appName}/windows`,
          "success",
          { count: windows.length }
        );

        res.json({ success: true, data: windows });
      } catch (error) {
        auditLogger.log(
          req.ip || "unknown",
          "get_app_windows",
          `/api/v1/applications/${req.params.appName}/windows`,
          "error",
          { error: (error as Error).message }
        );

        res
          .status(500)
          .json({ success: false, error: "Failed to get application windows" });
      }
    }
  );

  // Screenshot routes
  router.get("/screenshots/screen", async (req: Request, res: Response) => {
    try {
      const options = parseScreenshotOptions(req.query);
      const buffer = await screenshotEngine.captureScreen(options);

      // Process the image if needed
      const processedBuffer = await processImageIfRequested(
        buffer,
        req.query,
        imageProcessor
      );

      auditLogger.log(
        req.ip || "unknown",
        "capture_screen",
        "/api/v1/screenshots/screen",
        "success",
        { format: options.format || "png", size: processedBuffer.length }
      );

      res.contentType(options.format || "png");
      res.send(processedBuffer);
    } catch (error) {
      auditLogger.log(
        req.ip || "unknown",
        "capture_screen",
        "/api/v1/screenshots/screen",
        "error",
        { error: (error as Error).message }
      );

      res
        .status(500)
        .json({ success: false, error: "Failed to capture screenshot" });
    }
  });

  router.get("/screenshots/window/:id", async (req: Request, res: Response) => {
    try {
      const options = parseScreenshotOptions(req.query);
      const buffer = await screenshotEngine.captureWindow(
        req.params.id,
        options
      );

      // Process the image if needed
      const processedBuffer = await processImageIfRequested(
        buffer,
        req.query,
        imageProcessor
      );

      auditLogger.log(
        req.ip || "unknown",
        "capture_window",
        `/api/v1/screenshots/window/${req.params.id}`,
        "success",
        { format: options.format || "png", size: processedBuffer.length }
      );

      res.contentType(options.format || "png");
      res.send(processedBuffer);
    } catch (error) {
      auditLogger.log(
        req.ip || "unknown",
        "capture_window",
        `/api/v1/screenshots/window/${req.params.id}`,
        "error",
        { error: (error as Error).message }
      );

      res
        .status(500)
        .json({ success: false, error: "Failed to capture window screenshot" });
    }
  });

  router.get("/screenshots/region", async (req: Request, res: Response) => {
    try {
      const options = parseScreenshotOptions(req.query);

      // Ensure region is specified
      if (!options.region) {
        options.region = {
          x: parseInt(req.query.x as string) || 0,
          y: parseInt(req.query.y as string) || 0,
          width: parseInt(req.query.width as string) || 100,
          height: parseInt(req.query.height as string) || 100,
        };
      }

      const buffer = await screenshotEngine.captureScreen(options);

      // Process the image if needed
      const processedBuffer = await processImageIfRequested(
        buffer,
        req.query,
        imageProcessor
      );

      auditLogger.log(
        req.ip || "unknown",
        "capture_region",
        "/api/v1/screenshots/region",
        "success",
        {
          format: options.format || "png",
          size: processedBuffer.length,
          region: options.region,
        }
      );

      res.contentType(options.format || "png");
      res.send(processedBuffer);
    } catch (error) {
      auditLogger.log(
        req.ip || "unknown",
        "capture_region",
        "/api/v1/screenshots/region",
        "error",
        { error: (error as Error).message }
      );

      res
        .status(500)
        .json({ success: false, error: "Failed to capture region screenshot" });
    }
  });

  // Register routes
  app.use("/api/v1", router);

  // Home route
  app.get("/", (req: Request, res: Response) => {
    res.send("Screenshot MCP Server - API running");
  });
}

// Helper to parse screenshot options from request query
function parseScreenshotOptions(query: any): any {
  const options: any = {};

  if (query.format) options.format = query.format;
  if (query.display) options.display = parseInt(query.display);
  if (query.quality) options.quality = parseInt(query.quality);
  if (query.interactive === "true") options.interactive = true;
  if (query.noShadow === "true") options.noShadow = true;

  // Parse region if all parameters are present
  if (query.x && query.y && query.width && query.height) {
    options.region = {
      x: parseInt(query.x),
      y: parseInt(query.y),
      width: parseInt(query.width),
      height: parseInt(query.height),
    };
  }

  return options;
}

// Process image if requested with query parameters
async function processImageIfRequested(
  buffer: Buffer,
  query: any,
  imageProcessor: ImageProcessor
): Promise<Buffer> {
  // Return original buffer if no processing is requested
  if (!query.width && !query.height && !query.crop && !query.convert) {
    return buffer;
  }

  const options: any = {};

  // Handle resize
  if (query.width || query.height) {
    options.width = query.width ? parseInt(query.width) : undefined;
    options.height = query.height ? parseInt(query.height) : undefined;
  }

  // Handle crop
  if (query.cropX && query.cropY && query.cropWidth && query.cropHeight) {
    options.crop = {
      left: parseInt(query.cropX),
      top: parseInt(query.cropY),
      width: parseInt(query.cropWidth),
      height: parseInt(query.cropHeight),
    };
  }

  // Handle format conversion
  if (query.convert) {
    options.format = query.convert;
    if (query.quality) {
      options.quality = parseInt(query.quality);
    }
  }

  return await imageProcessor.processImage(buffer, options);
}
