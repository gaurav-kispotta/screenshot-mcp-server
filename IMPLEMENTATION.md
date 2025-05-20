# Screenshot MCP Server - Technical Implementation Details

## Technology Stack

### Core Technologies
- **Language**: Node.js with TypeScript (for easier development and cross-platform compatibility)
- **Built-in macOS Tools**: 
  - `screencapture` CLI utility (for capturing screenshots)
  - `osascript` for AppleScript execution (window management)
- **Process Management**: Node.js child_process module for executing shell commands
- **Network Stack**: Express.js for HTTP API and Socket.IO for WebSocket support
- **MCP Protocol**: Custom implementation based on Model Context Protocol specifications
- **Authentication**: JWT-based or OAuth 2.0
- **Configuration**: JSON format with environment variable overrides

## Architecture

### System Components

#### 1. Screenshot Engine
The core component responsible for capturing screenshots using the macOS `screencapture` utility.

```typescript
// Core structure - simplified example
interface ScreenshotOptions {
  format?: 'png' | 'jpg' | 'tiff' | 'pdf' | 'bmp';
  quality?: number; // 0-100 for jpg
  display?: number;
  window?: string; // Window ID or name
  region?: { x: number; y: number; width: number; height: number };
  interactive?: boolean;
  noShadow?: boolean;
}

class ScreenshotEngine {
  async captureScreen(options: ScreenshotOptions = {}): Promise<Buffer> {
    const outputPath = path.join(os.tmpdir(), `screenshot-${Date.now()}.${options.format || 'png'}`);
    const args: string[] = ['-x', outputPath]; // Silent mode
    
    if (options.format) args.push(`-t${options.format}`);
    if (options.display !== undefined) args.push(`-D${options.display}`);
    
    await execPromise(`/usr/sbin/screencapture ${args.join(' ')}`);
    const imageBuffer = await fs.promises.readFile(outputPath);
    await fs.promises.unlink(outputPath); // Clean up temp file
    return imageBuffer;
  }

  async captureWindow(windowId: string, options: ScreenshotOptions = {}): Promise<Buffer> {
    return this.captureScreen({ ...options, window: windowId });
  }
}
```

#### 2. Window Manager
Handles window enumeration, properties, and tracking using AppleScript and system commands.

```typescript
// Core structure - simplified example
interface WindowInfo {
  id: string;
  title: string;
  appName: string;
  pid: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class WindowManager {
  async listAllWindows(): Promise<WindowInfo[]> {
    // Using AppleScript to get window information
    const script = `
      tell application "System Events"
        set allWindows to {}
        set allProcesses to processes whose background only is false
        repeat with proc in allProcesses
          set procName to name of proc
          set procID to unix id of proc
          set windowList to windows of proc
          repeat with win in windowList
            set winName to name of win
            set winPos to position of win
            set winSize to size of win
            set end of allWindows to {procName:procName, procID:procID, name:winName, position:winPos, size:winSize}
          end repeat
        end repeat
        return allWindows
      end tell
    `;
    
    const result = await this.runAppleScript(script);
    return this.parseWindowList(result);
  }

  async getActiveWindow(): Promise<WindowInfo | null> {
    const script = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set frontAppName to name of frontApp
        set frontWin to first window of frontApp
        set winName to name of frontWin
        set winPos to position of frontWin
        set winSize to size of frontWin
        return {procName:frontAppName, procID:unix id of frontApp, name:winName, position:winPos, size:winSize}
      end tell
    `;
    
    const result = await this.runAppleScript(script);
    return this.parseWindowInfo(result);
  }
  
  private async runAppleScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}' -ss`, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }
  
  private parseWindowList(output: string): WindowInfo[] {
    // Implementation to parse AppleScript output to WindowInfo objects
    // ...
  }
}
```

#### 3. MCP Server
Implements the Media Control Protocol, handling client connections and requests using Express.js.

```typescript
// Core structure - simplified example
class MCPServer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIO.Server;
  private screenshotEngine: ScreenshotEngine;
  private windowManager: WindowManager;
  
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIO.Server(this.server);
    this.screenshotEngine = new ScreenshotEngine();
    this.windowManager = new WindowManager();
    
    this.setupRoutes();
    this.setupWebSocket();
  }
  
  public start(port = 3000): void {
    this.server.listen(port, () => {
      console.log(`MCP Server running on port ${port}`);
    });
  }
  
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }
  
  private setupRoutes(): void {
    // API Endpoints for RESTful interface
    this.app.get('/api/v1/windows', async (req, res) => {
      try {
        const windows = await this.windowManager.listAllWindows();
        res.json({ success: true, data: windows });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    this.app.get('/api/v1/screenshots/screen', async (req, res) => {
      try {
        const options = this.parseScreenshotOptions(req.query);
        const buffer = await this.screenshotEngine.captureScreen(options);
        
        res.contentType(options.format || 'png');
        res.send(buffer);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Additional routes...
  }
  
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected');
      
      socket.on('screenshot:request', async (request, callback) => {
        try {
          const buffer = await this.screenshotEngine.captureScreen(request.options);
          callback({ 
            success: true, 
            data: buffer.toString('base64'),
            format: request.options.format || 'png'
          });
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });
      
      // Additional websocket events...
    });
  }
  
  private parseScreenshotOptions(query: any): ScreenshotOptions {
    // Implementation to parse HTTP query params to options object
    // ...
  }
}
```

#### 4. Image Processor
Handles image format conversion, compression, and transformations using Sharp.js.

```typescript
// Core structure - simplified example
import sharp from 'sharp';

type ImageFormat = 'png' | 'jpeg' | 'webp' | 'tiff';

interface ProcessingOptions {
  format?: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  crop?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

class ImageProcessor {
  async processImage(imageBuffer: Buffer, options: ProcessingOptions): Promise<Buffer> {
    let processor = sharp(imageBuffer);
    
    // Apply resize if width or height specified
    if (options.width || options.height) {
      processor = processor.resize(options.width, options.height);
    }
    
    // Apply crop if specified
    if (options.crop) {
      processor = processor.extract({
        left: options.crop.left,
        top: options.crop.top,
        width: options.crop.width,
        height: options.crop.height
      });
    }
    
    // Set output format and quality
    switch (options.format) {
      case 'jpeg':
        processor = processor.jpeg({ quality: options.quality || 80 });
        break;
      case 'webp':
        processor = processor.webp({ quality: options.quality || 80 });
        break;
      case 'tiff':
        processor = processor.tiff({ quality: options.quality || 80 });
        break;
      case 'png':
      default:
        processor = processor.png();
        break;
    }
    
    return processor.toBuffer();
  }
}
```

#### 5. API Layer
RESTful API and WebSocket implementation are integrated directly into the MCP Server using Express.js and Socket.IO.

```typescript
// API endpoints are defined in the MCP Server class
// Additional middleware and route setup
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Setup example
function setupAPI(app: express.Application) {
  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use('/api/', apiLimiter);
  
  // Documentation route
  app.get('/api/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'api-docs.html'));
  });
}
```

#### 6. CLI Tool
Command-line interface for local usage and testing built with Commander.js.

```typescript
// Core structure - simplified example
import { program } from 'commander';
import { ScreenshotEngine } from './screenshot-engine';
import { WindowManager } from './window-manager';
import * as path from 'path';

// CLI setup
export function setupCLI() {
  const screenshotEngine = new ScreenshotEngine();
  const windowManager = new WindowManager();
  
  program
    .name('screenshot-mcp')
    .description('Screenshot Media Control Protocol Server and CLI')
    .version('1.0.0');
  
  // Server command
  program
    .command('server')
    .description('Start the MCP server')
    .option('-p, --port <number>', 'Port to listen on', '3000')
    .option('-c, --config <path>', 'Path to config file')
    .action(async (options) => {
      // Start server with options
      const { startServer } = await import('./server');
      await startServer(options);
    });
  
  // Screenshot commands
  program
    .command('capture')
    .description('Capture a screenshot')
    .option('-w, --window <id>', 'Capture a specific window by ID')
    .option('-o, --output <path>', 'Output file path', './screenshot.png')
    .option('-f, --format <format>', 'Image format (png, jpg, etc.)', 'png')
    .action(async (options) => {
      try {
        let buffer;
        if (options.window) {
          buffer = await screenshotEngine.captureWindow(options.window, {
            format: options.format
          });
        } else {
          buffer = await screenshotEngine.captureScreen({
            format: options.format
          });
        }
        
        await fs.promises.writeFile(options.output, buffer);
        console.log(`Screenshot saved to ${options.output}`);
      } catch (error) {
        console.error('Failed to capture screenshot:', error);
      }
    });
    
  // Window listing command
  program
    .command('windows')
    .description('List all windows')
    .option('-a, --app <name>', 'Filter by application name')
    .action(async (options) => {
      try {
        const windows = await windowManager.listAllWindows();
        const filtered = options.app 
          ? windows.filter(w => w.appName.toLowerCase().includes(options.app.toLowerCase()))
          : windows;
          
        console.table(filtered.map(w => ({
          ID: w.id,
          Title: w.title,
          Application: w.appName,
          PID: w.pid,
          Position: `${w.bounds.x},${w.bounds.y}`,
          Size: `${w.bounds.width}x${w.bounds.height}`
        })));
      } catch (error) {
        console.error('Failed to list windows:', error);
      }
    });
  
  return program;
}
```

### Data Flow

1. **Client Request Flow**:
   ```
   Client → API Layer → MCP Server → Screenshot Engine/Window Manager → MCP Server → API Layer → Client
   ```

2. **Screenshot Capture Flow**:
   ```
   Request → Window Identification → Permission Check → Core Graphics API → Image Processing → Response Formatting → Delivery
   ```

3. **Window Events Flow**:
   ```
   OS Window Event → Event Monitor → Event Queue → Client Notification via WebSocket
   ```

## Detailed Implementation Plan

### Phase 1: Core Screenshot Functionality (1 week)

#### Week 1: Foundation
- Set up Node.js project with TypeScript
- Implement basic `ScreenshotEngine` using the macOS `screencapture` command
- Create essential data models and interfaces
- Create wrapper for the AppleScript commands to manage windows
- Implement permission checks and handling
- Build basic CLI for testing functionality

```typescript
// Example: Window listing implementation using AppleScript
async function listAllWindows(): Promise<WindowInfo[]> {
  // Execute AppleScript to list all windows
  const script = `
    tell application "System Events"
      set windowList to {}
      set allProcesses to application processes where background only is false
      repeat with proc in allProcesses
        try
          set procName to name of proc
          set procID to unix id of proc
          set procWindows to windows of proc
          repeat with win in procWindows
            set winName to name of win
            set winPos to position of win
            set winSize to size of win
            
            set end of windowList to {app:procName, pid:procID, title:winName, x:(item 1 of winPos), y:(item 2 of winPos), width:(item 1 of winSize), height:(item 2 of winSize)}
          end repeat
        end try
      end repeat
      return windowList
    end tell
  `;
  
  try {
    const result = await execPromise(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    return parseAppleScriptOutput(result.stdout);
  } catch (error) {
    console.error('Error listing windows:', error);
    return [];
  }
}

// Helper function to parse AppleScript output into structured data
function parseAppleScriptOutput(output: string): WindowInfo[] {
  // Implementation to parse the AppleScript output format
  // ...
}
```

### Phase 2: MCP Server Implementation (2 weeks)

#### Week 2: Server Foundation
- Set up Express.js server with middleware
- Implement basic RESTful API endpoints for screenshots and window info
- Create Socket.IO setup for WebSocket connections
- Design MCP protocol messages and data structures
- Implement request/response serialization

#### Week 3: Server Features
- Implement connection handling and request routing
- Add authentication middleware (JWT-based)
- Create handlers for all screenshot and window commands
- Build service discovery using Bonjour/mDNS (using 'mdns' npm package)
- Add WebSocket support for real-time updates
- Implement basic rate limiting

**MCP Protocol Design Example**:
```json
// Request format
{
  "requestId": "unique-request-id",
  "action": "captureWindow",
  "parameters": {
    "windowId": 12345,
    "format": "png",
    "quality": 0.8,
    "scale": 1.0
  },
  "authentication": {
    "token": "jwt-token"
  }
}

// Response format
{
  "requestId": "unique-request-id",
  "status": "success",
  "data": {
    "image": "base64-encoded-image-data",
    "metadata": {
      "format": "png",
      "width": 1280,
      "height": 720,
      "timestamp": "2025-05-20T12:34:56Z"
    }
  }
}
```

### Phase 3: Advanced Features (2 weeks)

#### Week 4: Image Processing
- Add support for different image formats with Sharp.js
- Implement image quality and compression options
- Add scaling and region capture support
- Create caching mechanism for frequent requests

#### Week 5: Window Tracking
- Implement window event monitoring using AppleScript
- Add support for window hierarchy
- Create window tracking notifications over WebSockets
- Enhance filtering capabilities

**Image Processing Example**:
```typescript
import sharp from 'sharp';

async function convertFormat(inputBuffer: Buffer, format: string, quality: number): Promise<Buffer> {
  let sharpInstance = sharp(inputBuffer);
  
  switch (format.toLowerCase()) {
    case 'png':
      return sharpInstance.png().toBuffer();
    case 'jpg':
    case 'jpeg':
      return sharpInstance.jpeg({ quality }).toBuffer();
    case 'webp':
      return sharpInstance.webp({ quality }).toBuffer();
    case 'tiff':
      return sharpInstance.tiff({ quality }).toBuffer();
    default:
      return inputBuffer;
  }
}

// Usage with the screencapture command
async function captureAndConvert(options: ScreenshotOptions): Promise<Buffer> {
  // First capture with screencapture as PNG
  const rawImageBuffer = await captureScreenshot();
  
  // Then convert to desired format
  return convertFormat(rawImageBuffer, options.format || 'png', options.quality || 80);
}
```

### Phase 4: Optimization and Polish (2 weeks)

#### Week 6: Performance Optimization
- Implement request throttling and caching
- Optimize screenshot capture workflow
- Add compression optimization for network transfer
- Create memory management strategies for large images
- Performance testing and benchmarking

#### Week 7: Documentation and Security
- Enhance error handling and recovery
- Implement HTTPS and TLS for data in transit
- Add comprehensive logging (using Winston)
- Set up Swagger/OpenAPI documentation
- Write unit and integration tests (with Jest)
- Create example clients and user documentation

## Implementation Challenges and Solutions

### Challenge 1: Screen Recording Permissions
**Solution**: Check if the `screencapture` command can run successfully and guide users through permission granting process:

```typescript
async function checkScreenRecordingPermission(): Promise<boolean> {
  try {
    // Try to capture a small 1x1 screenshot as a test
    const testPath = path.join(os.tmpdir(), 'permission-test.png');
    await execPromise(`/usr/sbin/screencapture -x -t png -R 0,0,1,1 ${testPath}`);
    
    // Check if file exists and has content
    const stats = await fs.promises.stat(testPath);
    await fs.promises.unlink(testPath); // Clean up
    
    return stats.size > 0;
  } catch (error) {
    console.log('Screen recording permission not granted:', error);
    
    // Show guidance to user
    console.log('\nScreen Recording Permission Required:');
    console.log('1. Open System Preferences > Security & Privacy > Privacy');
    console.log('2. Select "Screen Recording" from the left sidebar');
    console.log('3. Ensure that Terminal or your application is checked in the list');
    
    return false;
  }
}
```

### Challenge 2: High-performance Image Transfer
**Solution**: Use compression, caching, and incremental updates:

1. Implement image differencing for consecutive screenshots
2. Use WebP or other efficient formats for network transfer
3. Add server-side caching for frequent requests
4. Use binary WebSocket transport instead of base64 encoding

### Challenge 3: Window ID Stability
**Solution**: Implement multi-factor window identification using AppleScript:

```typescript
interface WindowIdentifier {
  id?: string;
  pid?: number;
  title?: string;
  appName?: string;
  position?: { x: number, y: number };
  size?: { width: number, height: number };
}

async function findMatchingWindow(identifier: WindowIdentifier): Promise<WindowInfo | null> {
  const windows = await listAllWindows();
  
  // Score-based matching system
  return windows
    .map(window => {
      let score = 0;
      
      // Exact ID match gets highest priority
      if (identifier.id && window.id === identifier.id) score += 100;
      
      // PID is also very reliable
      if (identifier.pid && window.pid === identifier.pid) score += 50;
      
      // App name matching
      if (identifier.appName && window.appName.toLowerCase().includes(identifier.appName.toLowerCase())) {
        score += 25;
      }
      
      // Title matching (partial match is acceptable)
      if (identifier.title && window.title.toLowerCase().includes(identifier.title.toLowerCase())) {
        score += 20;
      }
      
      // Position and size are less reliable but still useful
      if (identifier.position && 
          Math.abs(window.bounds.x - identifier.position.x) < 10 &&
          Math.abs(window.bounds.y - identifier.position.y) < 10) {
        score += 10;
      }
      
      if (identifier.size && 
          Math.abs(window.bounds.width - identifier.size.width) < 10 &&
          Math.abs(window.bounds.height - identifier.size.height) < 10) {
        score += 10;
      }
      
      return { window, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(result => result.window)
    .shift() || null;
}
```

## Security Implementation

### Authentication
- JWT-based token authentication
- Configurable token expiration
- Role-based access control

### Encryption
- TLS for all HTTP and WebSocket traffic
- Optional payload encryption for sensitive data

### Access Control
- IP-based access restrictions
- Client identification and validation
- Configurable permission levels

### Audit Logging
```typescript
import winston from 'winston';

interface AuditLog {
  timestamp: Date;
  clientID: string;
  action: string;
  resource: string;
  result: string;
  details?: Record<string, any>;
}

class AuditLogger {
  private logger: winston.Logger;
  
  constructor(logPath: string = './logs') {
    // Create log directory if it doesn't exist
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        // Write to console in development
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        // Write audit logs to a file
        new winston.transports.File({ 
          filename: path.join(logPath, 'audit.log')
        })
      ]
    });
  }
  
  log(clientID: string, action: string, resource: string, result: string, details?: Record<string, any>) {
    const auditLog: AuditLog = {
      timestamp: new Date(),
      clientID,
      action,
      resource,
      result,
      details
    };
    
    this.logger.info('AUDIT', auditLog);
  }
}
```

## Testing Strategy

### Unit Testing
- Component-level tests for screenshot engine, window manager, etc.
- Mock objects for macOS APIs to enable testing without screen recording permissions

### Integration Testing
- End-to-end tests for API endpoints
- Performance benchmarks for screenshot capture and delivery

### Security Testing
- Authentication bypass attempts
- Rate limiting verification
- Fuzzing of request parameters

## Deployment Considerations

### Package Distribution
- Signed and notarized macOS application bundle
- Homebrew formula for easy installation
- Docker container for server deployment

### Configuration Management
- JSON configuration file with schema validation
- Environment variable overrides for containerized deployment
- Runtime configuration API for dynamic settings

### Monitoring
- Health check endpoints
- Prometheus metrics integration
- Resource usage monitoring

## Future Extension Points

### Phase 5: Advanced Capabilities (Future)
- Video streaming capabilities
- Mouse/keyboard event capture
- Interactive remote control
- Cross-platform client libraries

## Appendix A: Core API Reference

### Screenshot API
- `GET /api/v1/screenshots/screen?display=:id&format=:format&quality=:quality`
- `GET /api/v1/screenshots/window/:windowId?format=:format&quality=:quality`
- `GET /api/v1/screenshots/region?x=:x&y=:y&width=:width&height=:height&display=:id&format=:format&quality=:quality`

### Window API
- `GET /api/v1/windows`
- `GET /api/v1/windows/:windowId`
- `GET /api/v1/windows/active`
- `GET /api/v1/applications/:bundleId/windows`

### WebSocket API
- `ws://host:port/api/v1/events`
  - Supports subscription to window changes, focus events, etc.

## Appendix B: Development Environment Setup

### Required Tools
- Node.js 18+ and npm
- macOS 12+ (Monterey or later for best compatibility)
- TypeScript
- ESLint for code quality
- Prettier for code formatting

### Development Setup Commands
```bash
# Clone repository
git clone https://github.com/username/screenshot-mcp-server.git
cd screenshot-mcp-server

# Install dependencies
npm install

# Run TypeScript compilation in watch mode
npm run watch

# Run the server in development mode
npm run dev

# Run tests
npm test

# Build the project
npm run build

# Generate API documentation
npm run docs

# Start the server for production
npm start
```

### Project Structure
```
screenshot-mcp-server/
├── src/
│   ├── index.ts           # Main entry point
│   ├── server.ts          # Express server setup
│   ├── screenshot/        # Screenshot functionality
│   │   ├── engine.ts
│   │   └── processor.ts
│   ├── window/            # Window management
│   │   ├── manager.ts
│   │   └── events.ts
│   ├── api/               # API routes
│   │   ├── routes.ts
│   │   └── controllers/
│   ├── mcp/               # MCP protocol
│   │   ├── protocol.ts
│   │   └── handlers/
│   └── utils/             # Utilities
├── dist/                  # Compiled JavaScript
├── config/                # Configuration files
├── public/                # Static assets
├── tests/                 # Test files
├── package.json
└── tsconfig.json
```

## Appendix C: Required Permissions

The application requires the following permissions:

- `Screen Recording` permission - Required for the `screencapture` utility to function
- `Accessibility` permission - Required for AppleScript to access window information

### Permission Check Script
```typescript
import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import * as path from 'path';
import * as os from 'os';

function checkPermissions() {
  console.log('Checking required permissions...');
  
  // Check Screen Recording permission
  const testPath = path.join(os.tmpdir(), 'permission-test.png');
  try {
    execSync(`/usr/sbin/screencapture -x -t png -R 0,0,1,1 ${testPath}`);
    if (existsSync(testPath)) {
      console.log('✅ Screen Recording permission: Granted');
      unlinkSync(testPath);
    }
  } catch (error) {
    console.error('❌ Screen Recording permission: Not granted');
    console.log('Please enable Screen Recording permission in System Preferences > Security & Privacy > Privacy');
  }
  
  // Check Accessibility permission with an AppleScript test
  try {
    execSync(`osascript -e 'tell application "System Events" to get name of first application process'`);
    console.log('✅ Accessibility permission: Granted');
  } catch (error) {
    console.error('❌ Accessibility permission: Not granted');
    console.log('Please enable Accessibility permission in System Preferences > Security & Privacy > Privacy');
  }
}

// Run on startup
checkPermissions();
```
