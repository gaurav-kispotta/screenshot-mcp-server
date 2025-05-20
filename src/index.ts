import * as path from "path";
import * as os from "os";
import { existsSync } from "fs";
import { program } from "commander";
import { MCPServer } from "./server";
import {
  checkPermissions,
  showPermissionInstructions,
} from "./utils/permissions";

/**
 * Setup and parse CLI commands
 */
function setupCLI(): void {
  program
    .name("screenshot-mcp-server")
    .description("Screenshot Media Control Protocol (MCP) Server")
    .version("1.0.0");

  // Server command
  program
    .command("serve")
    .description("Start the MCP server")
    .option("-p, --port <number>", "Port to listen on", "3000")
    .option("-h, --host <hostname>", "Host to bind to", "localhost")
    .option("-c, --config <path>", "Path to config file")
    .action(async (options) => {
      // Load configuration from file if specified
      let config: any = {};
      if (options.config) {
        try {
          const configFile = require(path.resolve(options.config));
          config = configFile;
        } catch (error) {
          console.error(`Error loading config file: ${error}`);
          process.exit(1);
        }
      }

      // Override config with CLI options
      config.port = parseInt(options.port) || config.port || 3000;
      config.host = options.host || config.host || "localhost";

      // Check permissions
      const permissions = await checkPermissions();
      if (!permissions.screenRecording || !permissions.accessibility) {
        console.error(
          "Required permissions not granted. Some features may not work."
        );
        showPermissionInstructions(permissions);
      }

      // Start the server
      const server = new MCPServer(config);
      try {
        await server.start();
        console.log(
          `MCP Server running at http://${config.host}:${config.port}`
        );

        // Handle shutdown signals
        process.on("SIGINT", async () => {
          console.log("Shutting down server...");
          await server.stop();
          process.exit(0);
        });

        process.on("SIGTERM", async () => {
          console.log("Shutting down server...");
          await server.stop();
          process.exit(0);
        });
      } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
      }
    });

  // Parse arguments
  program.parse();
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, "../logs");
  try {
    if (!existsSync(logsDir)) {
      require("fs").mkdirSync(logsDir, { recursive: true });
    }
  } catch (error) {
    console.warn(`Warning: Could not create logs directory: ${error}`);
  }

  // If no CLI arguments provided, start the server with default settings
  if (process.argv.length <= 2) {
    console.log("Starting server with default settings...");

    // Check permissions first
    const permissions = await checkPermissions();
    if (!permissions.screenRecording || !permissions.accessibility) {
      console.error(
        "Required permissions not granted. Some features may not work."
      );
      showPermissionInstructions(permissions);
    }

    const server = new MCPServer();
    server
      .start()
      .then(() => {
        console.log(`Server running at http://localhost:3000`);
      })
      .catch((error) => {
        console.error("Failed to start server:", error);
        process.exit(1);
      });
  } else {
    // Setup CLI for command-based usage
    setupCLI();
  }
}

// Run the application
main().catch((error) => {
  console.error("Error running application:", error);
  process.exit(1);
});
