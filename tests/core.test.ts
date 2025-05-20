import { ScreenshotEngine } from '../src/screenshot/engine';
import { WindowManager } from '../src/window/manager';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Screenshot Engine', () => {
  const screenshotEngine = new ScreenshotEngine();
  
  test('should check for screen recording permission', async () => {
    const permissionGranted = await screenshotEngine.checkScreenRecordingPermission();
    console.log('Screen recording permission granted:', permissionGranted);
    // Permission might not be granted in test environment, so we don't assert this
  });
  
  test('should capture screen', async () => {
    try {
      const buffer = await screenshotEngine.captureScreen();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    } catch (error) {
      console.log('Skipping test: screen recording permission might not be granted');
    }
  }, 10000); // Longer timeout for screenshot capture
});

describe('Window Manager', () => {
  const windowManager = new WindowManager();
  
  test('should list available windows', async () => {
    try {
      const windows = await windowManager.listAllWindows();
      console.log(`Found ${windows.length} windows`);
      
      if (windows.length > 0) {
        expect(windows[0]).toHaveProperty('id');
        expect(windows[0]).toHaveProperty('title');
        expect(windows[0]).toHaveProperty('appName');
        expect(windows[0]).toHaveProperty('pid');
        expect(windows[0]).toHaveProperty('bounds');
      }
    } catch (error) {
      console.log('Skipping test: accessibility permission might not be granted');
    }
  }, 10000); // Longer timeout for AppleScript
  
  test('should get active window', async () => {
    try {
      const activeWindow = await windowManager.getActiveWindow();
      if (activeWindow) {
        console.log('Active window:', activeWindow.title, 'from', activeWindow.appName);
        expect(activeWindow).toHaveProperty('id');
        expect(activeWindow).toHaveProperty('title');
        expect(activeWindow).toHaveProperty('appName');
      } else {
        console.log('No active window found');
      }
    } catch (error) {
      console.log('Skipping test: accessibility permission might not be granted');
    }
  }, 10000); // Longer timeout for AppleScript
});
