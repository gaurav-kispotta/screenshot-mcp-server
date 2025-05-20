import { exec } from 'child_process';
import { promisify } from 'util';

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
    
    try {
      const result = await this.runAppleScript(script);
      return this.parseWindowList(result);
    } catch (error) {
      console.error('Error listing windows:', error);
      return [];
    }
  }

  /**
   * Get the active (frontmost) window
   */
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
    
    try {
      const result = await this.runAppleScript(script);
      const windows = this.parseWindowList(result);
      return windows.length > 0 ? windows[0] : null;
    } catch (error) {
      console.error('Error getting active window:', error);
      return null;
    }
  }
  
  /**
   * Get windows for a specific application
   */
  async getWindowsByApplication(appName: string): Promise<WindowInfo[]> {
    const allWindows = await this.listAllWindows();
    return allWindows.filter(window => 
      window.appName.toLowerCase().includes(appName.toLowerCase())
    );
  }
  
  /**
   * Find a window by ID
   */
  async getWindowById(id: string): Promise<WindowInfo | null> {
    const allWindows = await this.listAllWindows();
    return allWindows.find(window => window.id === id) || null;
  }

  /**
   * Find a matching window based on multiple criteria
   */
  async findMatchingWindow(identifier: WindowIdentifier): Promise<WindowInfo | null> {
    const windows = await this.listAllWindows();
    
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
  
  /**
   * Run an AppleScript and return its output
   */
  private async runAppleScript(script: string): Promise<string> {
    try {
      const { stdout } = await execPromise(`osascript -e '${script.replace(/'/g, "'\\''")}' -ss`);
      return stdout.trim();
    } catch (error) {
      console.error('AppleScript execution error:', error);
      throw error;
    }
  }
  
  /**
   * Parse the AppleScript output into window info objects
   */
  private parseWindowList(output: string): WindowInfo[] {
    if (!output || output === "{}") return [];
    
    try {
      // Split the output by lines and process each window entry
      const lines = output.split('\n');
      const windowInfoArray: WindowInfo[] = [];
      
      let currentWindow: Partial<WindowInfo> = {};
      let processedLines = 0;
      
      lines.forEach(line => {
        line = line.trim();
        
        // Look for properties in the AppleScript output
        if (line.startsWith('procName:')) {
          currentWindow.appName = line.replace('procName:', '').trim();
          processedLines++;
        } else if (line.startsWith('procID:')) {
          currentWindow.pid = parseInt(line.replace('procID:', '').trim(), 10);
          processedLines++;
        } else if (line.startsWith('name:')) {
          currentWindow.title = line.replace('name:', '').trim();
          processedLines++;
        } else if (line.startsWith('position:')) {
          const posStr = line.replace('position:', '').trim().replace('{', '').replace('}', '');
          const [x, y] = posStr.split(',').map(p => parseInt(p.trim(), 10));
          currentWindow.bounds = { x, y, width: 0, height: 0 };
          processedLines++;
        } else if (line.startsWith('size:')) {
          const sizeStr = line.replace('size:', '').trim().replace('{', '').replace('}', '');
          const [width, height] = sizeStr.split(',').map(p => parseInt(p.trim(), 10));
          if (currentWindow.bounds) {
            currentWindow.bounds.width = width;
            currentWindow.bounds.height = height;
          } else {
            currentWindow.bounds = { x: 0, y: 0, width, height };
          }
          processedLines++;
        }
        
        // When we've processed all properties of a window, add it to the array
        if (processedLines === 5) {
          currentWindow.id = `${currentWindow.pid}-${Date.now()}`;
          windowInfoArray.push(currentWindow as WindowInfo);
          currentWindow = {};
          processedLines = 0;
        }
      });
      
      return windowInfoArray;
    } catch (error) {
      console.error('Error parsing window list:', error);
      return [];
    }
  }
}

export default WindowManager;
