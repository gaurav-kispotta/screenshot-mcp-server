import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import winston from 'winston';
import { ScreenshotEngine } from './screenshot/engine';
import { ImageProcessor } from './screenshot/processor';
import { WindowManager } from './window/manager';
import { WindowEventMonitor } from './window/events';
import { setupRoutes } from './api/routes';
import { setupSocketHandlers } from './mcp/handlers';
import { AuditLogger } from './utils/audit';

// Interface for server configuration
export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
  jwtSecret: string;
}

// Default configuration
const defaultConfig: ServerConfig = {
  port: 3000,
  host: 'localhost',
  corsOrigins: ['*'],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  },
  jwtSecret: 'change-this-in-production'
};

export class MCPServer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private screenshotEngine: ScreenshotEngine;
  private imageProcessor: ImageProcessor;
  private windowManager: WindowManager;
  private windowEventMonitor: WindowEventMonitor;
  private auditLogger: AuditLogger;
  private config: ServerConfig;
  private logger: winston.Logger;
  
  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    // Setup logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log' 
        })
      ]
    });
    
    // Initialize core components
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.config.corsOrigins,
        methods: ['GET', 'POST']
      }
    });
    
    this.screenshotEngine = new ScreenshotEngine();
    this.imageProcessor = new ImageProcessor();
    this.windowManager = new WindowManager();
    this.windowEventMonitor = new WindowEventMonitor(this.windowManager);
    this.auditLogger = new AuditLogger('logs');
    
    // Setup middleware and routes
    this.setupMiddleware();
    setupRoutes(this.app, this.screenshotEngine, this.imageProcessor, this.windowManager, this.auditLogger);
    setupSocketHandlers(this.io, this.screenshotEngine, this.imageProcessor, this.windowManager, this.windowEventMonitor, this.auditLogger);
  }
  
  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigins
    }));
    
    // Body parsers
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Rate limiting
    const apiLimiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', apiLimiter);
    
    // Logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      next();
    });
    
    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Server error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error'
      });
    });
    
    // Serve static files
    this.app.use(express.static(path.join(__dirname, '../public')));
  }
  
  /**
   * Check required permissions
   */
  public async checkPermissions(): Promise<boolean> {
    try {
      const hasScreenCapture = await this.screenshotEngine.checkScreenRecordingPermission();
      
      if (!hasScreenCapture) {
        this.logger.error('Screen recording permission not granted');
        console.error('\nScreen Recording Permission Required:');
        console.error('1. Open System Preferences > Security & Privacy > Privacy');
        console.error('2. Select "Screen Recording" from the left sidebar');
        console.error('3. Ensure that Terminal or your application is checked in the list');
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error checking permissions:', error);
      return false;
    }
  }
  
  /**
   * Start the server
   */
  public start(port: number = this.config.port): Promise<void> {
    return new Promise((resolve, reject) => {
      this.checkPermissions().then(hasPermissions => {
        if (!hasPermissions) {
          reject(new Error('Required permissions not granted'));
          return;
        }
        
        this.server.listen(port, () => {
          this.logger.info(`MCP Server running on http://localhost:${port}`);
          this.windowEventMonitor.start();
          resolve();
        });
        
        this.server.on('error', (error) => {
          this.logger.error('Server failed to start:', error);
          reject(error);
        });
      });
    });
  }
  
  /**
   * Stop the server
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.windowEventMonitor.stop();
      
      this.server.close(() => {
        this.logger.info('Server stopped');
        resolve();
      });
    });
  }
}

export default MCPServer;
