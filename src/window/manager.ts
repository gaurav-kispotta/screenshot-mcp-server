import { exec } from 'node:child_process';
import { promisify } from 'node:util';
// We'll import get-windows dynamically

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
   */
  async listAllWindows(): Promise<WindowInfo[]> {
    try {
      // Import the package dynamically
      const { openWindows } = await import('get-windows');
      
      // Get all windows using get-windows package
      const windows = await openWindows();
      
      // Convert to WindowInfo format
      return windows.map((window: any) => this.createWindowInfo(window));
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
      // Import the package dynamically
      const { activeWindow } = await import('get-windows');
      
      const active = await activeWindow();
      if (!active) return null;
      
      return this.createWindowInfo(active);
    } catch (error) {
      console.error('Error getting active window:', error);
      return null;
    }
  }
  
  /**
   * Get windows for a specific application
   */
  async getWindowsByApplication(appName: string): Promise<WindowInfo[]> {
    try {
      // Import the package dynamically
      const { openWindows } = await import('get-windows');
      
      const windows = await openWindows();
      
      // Filter windows by application name
      const filteredWindows = windows.filter((window: any) => 
        window.owner.name.toLowerCase().includes(appName.toLowerCase())
      );
      
      return filteredWindows.map((window: any) => this.createWindowInfo(window));
    } catch (error) {
      console.error('Error getting windows by application:', error);
      return [];
    }
  }
  
  /**
   * Find a window by ID
   */
  async getWindowById(id: string): Promise<WindowInfo | null> {
    try {
      // Import the package dynamically
      const { openWindows } = await import('get-windows');
      
      const windows = await openWindows();
      
      // Find window with matching ID
      const window = windows.find((window: any) => window.id.toString() === id);
      
      return window ? this.createWindowInfo(window) : null;
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
      // Import the package dynamically
      const { openWindows } = await import('get-windows');
      
      const windows = await openWindows();
      
      // Calculate scores for each window
      const scoredWindows = windows.map((window: any) => {
        const windowInfo = this.createWindowInfo(window);
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
        
        return { window: windowInfo, score };
      });
      
      // Sort by score (highest first) and get the best match
      scoredWindows.sort((a: any, b: any) => b.score - a.score);
      
      // Return the window if it scores more than 0 points
      return scoredWindows.length > 0 && scoredWindows[0].score > 0 
        ? scoredWindows[0].window 
        : null;
    } catch (error) {
      console.error('Error finding matching window:', error);
      return null;
    }
  }
  
  /**
   * Parse window list from AppleScript output format
   * Used for testing and fallback mechanisms
   */
  private parseWindowList(output: string): WindowInfo[] {
    if (!output || output === '{}') {
      return [];
    }
    
    try {
      // Handle malformed input
      if (output.includes('incomplete data') || !output.includes('procName:')) {
        return [];
      }
      
      // Handle nested object format: {{procName:"App1", ...}, {procName:"App2", ...}}
      if (output.startsWith('{{')) {
        // Extract individual window objects
        const windowObjects = this.extractNestedObjects(output);
        
        return windowObjects.map((windowObj, index) => {
          const matches = {
            procName: windowObj.match(/procName:"([^"]+)"/),
            procID: windowObj.match(/procID:(\d+)/),
            name: windowObj.match(/name:"([^"]+)"/),
            position: windowObj.match(/position:{(\d+), (\d+)}/),
            size: windowObj.match(/size:{(\d+), (\d+)}/)
          };
          
          // Extract values or use defaults
          const procName = matches.procName ? matches.procName[1] : 'Unknown';
          const procID = matches.procID ? parseInt(matches.procID[1], 10) : 0;
          const name = matches.name ? matches.name[1] : 'Untitled';
          
          // Extract position and size
          const x = matches.position ? parseInt(matches.position[1], 10) : 0;
          const y = matches.position ? parseInt(matches.position[2], 10) : 0;
          const width = matches.size ? parseInt(matches.size[1], 10) : 0;
          const height = matches.size ? parseInt(matches.size[2], 10) : 0;
          
          return {
            id: `${procID}-${index}`, // Generate a unique ID
            title: name,
            appName: procName,
            pid: procID,
            bounds: { x, y, width, height }
          };
        });
      }
      
      // Handle line-by-line format
      const lines = output.trim().split('\n\n');
      return lines.map((windowBlock, index) => {
        const windowLines = windowBlock.split('\n');
        const windowData: Record<string, string> = {};
        
        // Parse each line into key-value pairs
        windowLines.forEach(line => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            windowData[key] = value;
          }
        });
        
        // Extract position coordinates
        let x = 0, y = 0;
        if (windowData.position) {
          const posMatch = windowData.position.match(/{(\d+), (\d+)}/);
          if (posMatch) {
            x = parseInt(posMatch[1], 10);
            y = parseInt(posMatch[2], 10);
          }
        }
        
        // Extract size dimensions
        let width = 0, height = 0;
        if (windowData.size) {
          const sizeMatch = windowData.size.match(/{(\d+), (\d+)}/);
          if (sizeMatch) {
            width = parseInt(sizeMatch[1], 10);
            height = parseInt(sizeMatch[2], 10);
          }
        }
        
        return {
          id: `${windowData.procID || '0'}-${index}`, // Generate a unique ID
          title: windowData.name || 'Untitled',
          appName: windowData.procName || 'Unknown',
          pid: windowData.procID ? parseInt(windowData.procID, 10) : 0,
          bounds: { x, y, width, height }
        };
      });
    } catch (error) {
      console.error('Error parsing window list:', error);
      return [];
    }
  }
  
  /**
   * Helper method to extract nested objects from AppleScript output
   */
  private extractNestedObjects(output: string): string[] {
    // Remove the outer braces
    const content = output.substring(1, output.length - 1);
    
    const objects: string[] = [];
    let currentObject = '';
    let braceCount = 0;
    let inQuotes = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      // Handle quotes
      if (char === '"' && content[i - 1] !== '\\') {
        inQuotes = !inQuotes;
      }
      
      // Count nested braces only if not in quotes
      if (!inQuotes) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        
        // Object separator
        if (char === ',' && braceCount === 0) {
          if (currentObject.trim()) {
            objects.push(currentObject.trim());
          }
          currentObject = '';
          continue;
        }
      }
      
      currentObject += char;
    }
    
    // Add the last object
    if (currentObject.trim()) {
      objects.push(currentObject.trim());
    }
    
    return objects;
  }
  
  /**
   * Helper method to create a WindowInfo object from get-windows result
   */
  private createWindowInfo(windowData: any): WindowInfo {
    return {
      id: windowData.id.toString(),
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
