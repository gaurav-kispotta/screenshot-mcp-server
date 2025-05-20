import EventEmitter from "events";
import { exec } from "child_process";
import { promisify } from "util";
import { WindowManager, WindowInfo } from "./manager";

const execPromise = promisify(exec);

export interface WindowEvent {
  type: "created" | "closed" | "focused" | "moved" | "resized";
  window: WindowInfo;
  timestamp: Date;
}

export class WindowEventMonitor extends EventEmitter {
  private isRunning: boolean = false;
  private pollInterval: number = 1000; // Default polling interval in ms
  private windowManager: WindowManager;
  private lastWindowState: Map<string, WindowInfo> = new Map();
  private intervalId?: NodeJS.Timeout;

  constructor(windowManager: WindowManager, pollInterval: number = 1000) {
    super();
    this.windowManager = windowManager;
    this.pollInterval = pollInterval;
  }

  /**
   * Start monitoring window events
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // Initialize window state
    const windows = await this.windowManager.listAllWindows();
    windows.forEach((window) => {
      this.lastWindowState.set(window.id, window);
    });

    // Start polling for changes
    this.intervalId = setInterval(async () => {
      await this.checkForWindowChanges();
    }, this.pollInterval);

    console.log("Window event monitoring started");
  }

  /**
   * Stop monitoring window events
   */
  public stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.isRunning = false;
    console.log("Window event monitoring stopped");
  }

  /**
   * Set the polling interval
   */
  public setPollInterval(ms: number): void {
    this.pollInterval = ms;

    if (this.isRunning && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(async () => {
        await this.checkForWindowChanges();
      }, this.pollInterval);
    }
  }

  /**
   * Check for window changes by comparing current state to last state
   */
  private async checkForWindowChanges(): Promise<void> {
    try {
      // Get current window state
      const currentWindows = await this.windowManager.listAllWindows();
      const currentWindowMap = new Map<string, WindowInfo>();

      // Track which windows from the previous state have been seen
      const seenWindowIds = new Set<string>();

      // Check for new or modified windows
      for (const window of currentWindows) {
        currentWindowMap.set(window.id, window);

        // If this window was in our previous state
        if (this.lastWindowState.has(window.id)) {
          seenWindowIds.add(window.id);
          const previousWindow = this.lastWindowState.get(window.id)!;

          // Check if window was moved
          if (
            window.bounds.x !== previousWindow.bounds.x ||
            window.bounds.y !== previousWindow.bounds.y
          ) {
            this.emit("window", {
              type: "moved",
              window,
              timestamp: new Date(),
            });
          }

          // Check if window was resized
          if (
            window.bounds.width !== previousWindow.bounds.width ||
            window.bounds.height !== previousWindow.bounds.height
          ) {
            this.emit("window", {
              type: "resized",
              window,
              timestamp: new Date(),
            });
          }
        } else {
          // New window
          this.emit("window", {
            type: "created",
            window,
            timestamp: new Date(),
          });
        }
      }

      // Check for closed windows (in previous state but not current)
      for (const [id, window] of this.lastWindowState.entries()) {
        if (!seenWindowIds.has(id)) {
          this.emit("window", {
            type: "closed",
            window,
            timestamp: new Date(),
          });
        }
      }

      // Check for focused window
      const activeWindow = await this.windowManager.getActiveWindow();
      if (activeWindow) {
        this.emit("window", {
          type: "focused",
          window: activeWindow,
          timestamp: new Date(),
        });
      }

      // Update the window state for next comparison
      this.lastWindowState = currentWindowMap;
    } catch (error) {
      console.error("Error monitoring windows:", error);
    }
  }
}

export default WindowEventMonitor;
