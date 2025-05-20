import { Server as SocketIOServer, Socket } from 'socket.io';
import { ScreenshotEngine } from '../screenshot/engine';
import { ImageProcessor } from '../screenshot/processor';
import { WindowManager } from '../window/manager';
import { WindowEventMonitor } from '../window/events';
import { AuditLogger } from '../utils/audit';

export function setupSocketHandlers(
  io: SocketIOServer,
  screenshotEngine: ScreenshotEngine,
  imageProcessor: ImageProcessor,
  windowManager: WindowManager,
  windowEventMonitor: WindowEventMonitor,
  auditLogger: AuditLogger
): void {
  // Authentication middleware for WebSocket
  io.use(async (socket, next) => {
    // For now, allow all connections
    // In production, implement proper auth:
    // const token = socket.handshake.auth.token;
    // verify token...
    next();
  });
  
  // Connection handler
  io.on('connection', (socket: Socket) => {
    const clientId = socket.id;
    console.log(`Client connected: ${clientId}`);
    auditLogger.log(clientId, 'connection', 'websocket', 'success');
    
    // Handle window subscriptions
    let windowSubscribed = false;
    
    socket.on('subscribe:window_events', () => {
      if (windowSubscribed) return;
      
      windowSubscribed = true;
      auditLogger.log(clientId, 'subscribe', 'window_events', 'success');
      
      // Add listener for window events
      const windowEventListener = (event: any) => {
        socket.emit('window_event', event);
      };
      
      windowEventMonitor.on('window', windowEventListener);
      
      // Remove listener on disconnect or unsubscribe
      socket.on('unsubscribe:window_events', () => {
        windowEventMonitor.off('window', windowEventListener);
        windowSubscribed = false;
        auditLogger.log(clientId, 'unsubscribe', 'window_events', 'success');
      });
      
      socket.on('disconnect', () => {
        windowEventMonitor.off('window', windowEventListener);
      });
    });
    
    // Handle screenshot requests
    socket.on('screenshot:capture', async (data, callback) => {
      try {
        const { target, options } = data;
        let buffer: Buffer;
        
        if (target === 'screen') {
          buffer = await screenshotEngine.captureScreen(options);
          auditLogger.log(clientId, 'capture_screen', 'websocket', 'success');
        } else if (target === 'window' && data.windowId) {
          buffer = await screenshotEngine.captureWindow(data.windowId, options);
          auditLogger.log(clientId, 'capture_window', 'websocket', 'success');
        } else {
          throw new Error('Invalid screenshot target');
        }
        
        // Process image if requested
        if (options.width || options.height || options.crop || options.format) {
          buffer = await imageProcessor.processImage(buffer, {
            width: options.width,
            height: options.height,
            crop: options.crop,
            format: options.format as any,
            quality: options.quality
          });
        }
        
        // Get metadata
        const metadata = await imageProcessor.getMetadata(buffer);
        
        callback({
          success: true,
          image: buffer.toString('base64'),
          metadata: {
            format: options.format || 'png',
            width: metadata.width,
            height: metadata.height,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        auditLogger.log(clientId, 'capture_screenshot', 'websocket', 'error', {
          error: (error as Error).message
        });
        
        callback({
          success: false,
          error: (error as Error).message
        });
      }
    });
    
    // Handle window listing requests
    socket.on('windows:list', async (data, callback) => {
      try {
        const windows = await windowManager.listAllWindows();
        auditLogger.log(clientId, 'list_windows', 'websocket', 'success');
        callback({
          success: true,
          windows
        });
      } catch (error) {
        auditLogger.log(clientId, 'list_windows', 'websocket', 'error', {
          error: (error as Error).message
        });
        
        callback({
          success: false,
          error: (error as Error).message
        });
      }
    });
    
    // Handle active window requests
    socket.on('windows:active', async (data, callback) => {
      try {
        const window = await windowManager.getActiveWindow();
        auditLogger.log(clientId, 'get_active_window', 'websocket', 'success');
        
        callback({
          success: true,
          window
        });
      } catch (error) {
        auditLogger.log(clientId, 'get_active_window', 'websocket', 'error', {
          error: (error as Error).message
        });
        
        callback({
          success: false,
          error: (error as Error).message
        });
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${clientId}`);
      auditLogger.log(clientId, 'disconnect', 'websocket', 'success');
    });
  });
}
