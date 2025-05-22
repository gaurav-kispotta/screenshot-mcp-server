import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { exec, ExecOptions } from 'node:child_process';
import { promisify } from 'node:util';

// Define types
export interface ScreenshotOptions {
  format?: 'png' | 'jpg' | 'tiff' | 'pdf' | 'bmp';
  quality?: number; // 0-100 for jpg
  display?: number;
  window?: string; // Window ID or name
  region?: { x: number; y: number; width: number; height: number };
  interactive?: boolean;
  noShadow?: boolean;
}

// Promisify exec
const execPromise = promisify(exec);

export class ScreenshotEngine {
  /**
   * Captures a screenshot of the entire screen or a specific display
   */
  async captureScreen(options: ScreenshotOptions = {}): Promise<Buffer> {
    const outputPath = path.join(os.tmpdir(), `screenshot-${Date.now()}.${options.format || 'png'}`);
    const args: string[] = ['-x', outputPath]; // Silent mode
    
    if (options.format) args.push(`-t${options.format}`);
    if (options.display !== undefined) args.push(`-D${options.display}`);
    if (options.noShadow) args.push('-o');
    if (options.interactive) args.push('-i');
    
    // Region capture
    if (options.region) {
      const { x, y, width, height } = options.region;
      args.push(`-R${x},${y},${width},${height}`);
    }
    
    try {
      await execPromise(`/usr/sbin/screencapture ${args.join(' ')}`);
      const imageBuffer = await fs.promises.readFile(outputPath);
      await fs.promises.unlink(outputPath); // Clean up temp file
      return imageBuffer;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      throw new Error(`Failed to capture screenshot: ${(error as Error).message}`);
    }
  }

  /**
   * Captures a screenshot of a specific window
   */
  async captureWindow(windowId: string, options: ScreenshotOptions = {}): Promise<Buffer> {
    const outputPath = path.join(os.tmpdir(), `screenshot-${Date.now()}.${options.format || 'png'}`);
    const args: string[] = ['-x', outputPath, '-l', windowId]; // Silent mode, window ID
    
    if (options.format) args.push(`-t${options.format}`);
    if (options.noShadow) args.push('-o');
    
    try {
      await execPromise(`/usr/sbin/screencapture ${args.join(' ')}`);
      const imageBuffer = await fs.promises.readFile(outputPath);
      await fs.promises.unlink(outputPath); // Clean up temp file
      return imageBuffer;
    } catch (error) {
      console.error(`Screenshot capture of window ${windowId} failed:`, error);
      throw new Error(`Failed to capture window screenshot: ${(error as Error).message}`);
    }
  }

  /**
   * Checks if screen recording permission is granted
   */
  async checkScreenRecordingPermission(): Promise<boolean> {
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
      return false;
    }
  }
}

export default ScreenshotEngine;
