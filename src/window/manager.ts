import { exec } from 'child_process';
import { promisify } from 'util';
import activeWin from 'active-win';

const execPromise = promisify(exec);

// Interface for window information
export interface WindowInfo {
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

// Interface for window identification
export interface WindowIdentifier {
  id?: string;
  pid?: number;
  title?: string;
  appName?: string;
  position?: { x: number, y: number };
  size?: { width: number, height: number };
}

export class WindowManager {
  /**
   * List all available windows
   * 
   * NOTE: The active-win package only returns the currently active window.
   * For a complete implementation that lists all windows, consider using:
   * - For macOS: 'active-win-all', 'mac-windows', or 'node-mac-windows'
   * - For Windows: 'node-window-manager'
   * - For Linux: 'x11' based solutions
   */
  async listAllWindows(): Promise<WindowInfo[]> {
    try {
      // For multiple windows, we need to use a different approach as active-win only gives the active window
      // We'll use another method or package to list all windows
      // For now, simulate multiple windows with the active window
      
      // Get the active window
      const activeWindow = await activeWin();
      if (!activeWindow) return [];
      
      // Create a WindowInfo object for the active window using the helper method
      const windowInfo = this.createWindowInfo(activeWindow);
      
      // For a complete implementation, you would need to use a package that can list all windows
      // For macOS, you could use 'active-win-all' or similar packages
      
      return [windowInfo];
    } catch (error) {
      console.error('Error listing windows:', error);
      return [];
    }
  }

  /**
   * Get the active (frontmost) window
   */
  async getActiveWindow(): Promise<WindowInfo | null> {
    try {
      const activeWindow = await activeWin();
      if (!activeWindow) return null;
      
      return this.createWindowInfo(activeWindow);
    } catch (error) {
      console.error('Error getting active window:', error);
      return null;
    }
  }
  
  /**
   * Get windows for a specific application
   */
  async getWindowsByApplication(appName: string): Promise<WindowInfo[]> {
    // Since active-win only gives the active window, we can only return the active window if it matches
    try {
      const activeWindow = await activeWin();
      if (!activeWindow) return [];
      
      // Check if the active window belongs to the requested application
      if (activeWindow.owner.name.toLowerCase().includes(appName.toLowerCase())) {
        return [this.createWindowInfo(activeWindow)];
      }
      
      return [];
    } catch (error) {
      console.error('Error getting windows by application:', error);
      return [];
    }
  }
  
  /**
   * Find a window by ID
   */
  async getWindowById(id: string): Promise<WindowInfo | null> {
    // Since we only have access to the active window, check if it matches the ID
    // Note: This is limited by active-win's capabilities
    try {
      const activeWindow = await activeWin();
      if (!activeWindow) return null;
      
      // Check if the active window ID matches the requested ID
      if (activeWindow.id.toString() === id) {
        return this.createWindowInfo(activeWindow);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting window by ID:', error);
      return null;
    }
  }

  /**
   * Find a matching window based on multiple criteria
   */
  async findMatchingWindow(identifier: WindowIdentifier): Promise<WindowInfo | null> {
    try {
      const activeWindow = await activeWin();
      if (!activeWindow) return null;
      
      // Create the window info object
      const windowInfo = this.createWindowInfo(activeWindow);
      
      // Calculate a score based on the matching criteria
      let score = 0;
      
      // Exact ID match gets highest priority
      if (identifier.id && windowInfo.id === identifier.id) score += 100;
      
      // PID is also very reliable
      if (identifier.pid && windowInfo.pid === identifier.pid) score += 50;
      
      // App name matching
      if (identifier.appName && windowInfo.appName.toLowerCase().includes(identifier.appName.toLowerCase())) {
        score += 25;
      }
      
      // Title matching (partial match is acceptable)
      if (identifier.title && windowInfo.title.toLowerCase().includes(identifier.title.toLowerCase())) {
        score += 20;
      }
      
      // Position and size are less reliable but still useful
      if (identifier.position && 
          Math.abs(windowInfo.bounds.x - identifier.position.x) < 10 &&
          Math.abs(windowInfo.bounds.y - identifier.position.y) < 10) {
        score += 10;
      }
      
      if (identifier.size && 
          Math.abs(windowInfo.bounds.width - identifier.size.width) < 10 &&
          Math.abs(windowInfo.bounds.height - identifier.size.height) < 10) {
        score += 10;
      }
      
      // Return the window if it scores more than 0 points
      return score > 0 ? windowInfo : null;
    } catch (error) {
      console.error('Error finding matching window:', error);
      return null;
    }
  }
  
  /**
   * Helper method to create a WindowInfo object from active-win result
   */
  private createWindowInfo(windowData: activeWin.Result): WindowInfo {
    return {
      id: windowData.id.toString(), // Use the native window ID provided by active-win
      title: windowData.title,
      appName: windowData.owner.name,
      pid: windowData.owner.processId,
      bounds: {
        x: windowData.bounds.x,
        y: windowData.bounds.y,
        width: windowData.bounds.width,
        height: windowData.bounds.height
      }
    };
  }
}

export default WindowManager;
