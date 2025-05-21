import * as path from 'path';
import * as os from 'os';
import { existsSync } from 'fs';
import { program } from 'commander';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { ScreenshotEngine } from './screenshot/engine';
import { ImageProcessor } from './screenshot/processor';
import { WindowManager } from './window/manager';
import { WindowEventMonitor } from './window/events';
import { AuditLogger } from './utils/audit';
import { setupRoutes } from './api/routes';
import { checkPermissions, showPermissionInstructions } from './utils/permissions';

/**
 * Setup and parse CLI commands
 */
function setupCLI(): void {
  program
    .name('screenshot-mcp-server')
    .description('Screenshot Media Control Protocol (MCP) Server')
    .version('1.0.0');
  
  // Server command
  program
    .command('serve')
    .description('Start the MCP server')
    .option('-p, --port <number>', 'Port to listen on', '3000')
    .option('-h, --host <hostname>', 'Host to bind to', 'localhost')
    .option('-c, --config <path>', 'Path to config file')
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
      config.host = options.host || config.host || 'localhost';
      
      // Check permissions
      const permissions = await checkPermissions();
      if (!permissions.screenRecording || !permissions.accessibility) {
        console.error('Required permissions not granted. Some features may not work.');
        showPermissionInstructions(permissions);
      }
      
      // Start the server
      try {
        const server = await startMCPServer(config);
        console.log(`MCP Server running at http://${config.host}:${config.port}`);
        
        // Handle shutdown signals
        process.on('SIGINT', async () => {
          console.log('Shutting down server...');
          await server.close();
          process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
          console.log('Shutting down server...');
          await server.close();
          process.exit(0);
        });
      } catch (error: any) {
        console.error('Failed to start server:', error);
        process.exit(1);
      }
    });
  
  // Parse arguments
  program.parse();
}

/**
 * Start the MCP server with the provided configuration
 */
async function startMCPServer(config: any): Promise<McpServer> {
  // Initialize core components
  const screenshotEngine = new ScreenshotEngine();
  const imageProcessor = new ImageProcessor();
  const windowManager = new WindowManager();
  const windowEventMonitor = new WindowEventMonitor(windowManager);
  const auditLogger = new AuditLogger('logs');
  
  // Create Express application
  const app = express();
  
  // Setup standard Express middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Setup API routes for legacy endpoints
  setupRoutes(app, screenshotEngine, imageProcessor, windowManager, auditLogger);
  
  // Create MCP server
  const mcpServer = new McpServer({
    name: "screenshot-mcp-server",
    version: "1.0.0"
  }, {
    capabilities: {
      resources: { listChanged: true },
      tools: { listChanged: true }
    }
  });
  
  // Register screenshot tools using registerTool method
  mcpServer.registerTool(
    "takeScreenshot", 
    {
      description: "Takes a screenshot of the entire screen or a specific window",
      inputSchema: {},
      outputSchema: {
        success: z.boolean().describe("Whether the screenshot was captured successfully"),
        timestamp: z.string().optional().describe("ISO timestamp when the screenshot was taken"),
        error: z.string().optional().describe("Error message if the screenshot failed")
      }
    },
    async (params, extra) => {
      try {
        const screenshotBuffer = await screenshotEngine.captureScreen();
        // Convert image to base64 for AI agent to view
        const base64Image = screenshotBuffer.toString('base64');
        
        return {
          structuredContent: {
            success: true,
            timestamp: new Date().toISOString()
          },
          content: [
            {
              type: "text",
              text: "Screenshot captured"
            },
            {
              type: "image",
              data: base64Image,
              mimeType: "image/png"
            }
          ]
        };
      } catch (error: any) {
        return {
          structuredContent: {
            success: false,
            error: error.message
          },
          content: [
            {
              type: "text",
              text: `Error taking screenshot: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );
  
  // Store transports by session ID
  const transports: Record<string, StreamableHTTPServerTransport> = {};
  
  // Handle POST requests for MCP
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;
    
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => {
          const uuid = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
          return uuid;
        },
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID
          transports[sessionId] = transport;
        }
      });
      // Fallback for cases where onsessioninitialized might not be called immediately
      if (transport.sessionId && !transports[transport.sessionId]) {
        transports[transport.sessionId] = transport;
      }
      
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };
      
      await mcpServer.connect(transport);
    }
    
    await transport.handleRequest(req, res, req.body);
  });
  
  // Start windowEventMonitor
  windowEventMonitor.start();
  
  // Start the server
  const port = config.port || 3000;
  const host = config.host || 'localhost';
  
  // Return a Promise that resolves when the server is started
  return new Promise((resolve, reject) => {
    app.listen(port, host, () => {
      console.log(`Server running on http://${host}:${port}`);
      resolve(mcpServer);
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, '../logs');
  try {
    if (!existsSync(logsDir)) {
      require('fs').mkdirSync(logsDir, { recursive: true });
    }
  } catch (error: any) {
    console.warn(`Warning: Could not create logs directory: ${error}`);
  }
  
  // If no CLI arguments provided, start the server with default settings
  if (process.argv.length <= 2) {
    console.log('Starting server with default settings...');
    
    // Check permissions first
    const permissions = await checkPermissions();
    if (!permissions.screenRecording || !permissions.accessibility) {
      console.error('Required permissions not granted. Some features may not work.');
      showPermissionInstructions(permissions);
    }
    
    try {
      const server = await startMCPServer({ port: 3000, host: 'localhost' });
      console.log('Server running at http://localhost:3000');
      
      // Handle shutdown signals
      process.on('SIGINT', async () => {
        console.log('Shutting down server...');
        await server.close();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('Shutting down server...');
        await server.close();
        process.exit(0);
      });
    } catch (error: any) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  } else {
    // Setup CLI for command-based usage
    setupCLI();
  }
}

// Run the application
main().catch(error => {
  console.error('Error running application:', error);
  process.exit(1);
});
