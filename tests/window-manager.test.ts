import { WindowManager } from '../src/window/manager';

describe('Window Manager', () => {
  let windowManager: WindowManager;
  
  beforeEach(() => {
    windowManager = new WindowManager();
  });

  describe('parseWindowList', () => {
    // Accessing the private method using type assertion
    const parseWindowList = (output: string) => {
      return (windowManager as any).parseWindowList(output);
    };

    it('should handle empty output', () => {
      expect(parseWindowList('')).toEqual([]);
      expect(parseWindowList('{}')).toEqual([]);
    });

    it('should parse line-by-line formatted output', () => {
      const output = `
procName: Chrome
procID: 1234
name: Google - Chrome
position: {10, 20}
size: {800, 600}

procName: Terminal
procID: 5678
name: bash - Terminal
position: {50, 100}
size: {600, 400}
      `.trim();

      const result = parseWindowList(output);
      
      expect(result.length).toBe(2);
      
      // Test first window
      expect(result[0].appName).toBe('Chrome');
      expect(result[0].pid).toBe(1234);
      expect(result[0].title).toBe('Google - Chrome');
      expect(result[0].bounds).toEqual({ x: 10, y: 20, width: 800, height: 600 });
      expect(result[0].id).toBeDefined();

      // Test second window
      expect(result[1].appName).toBe('Terminal');
      expect(result[1].pid).toBe(5678);
      expect(result[1].title).toBe('bash - Terminal');
      expect(result[1].bounds).toEqual({ x: 50, y: 100, width: 600, height: 400 });
      expect(result[1].id).toBeDefined();
    });

    it('should parse nested object formatted output', () => {
      const output = `{{procName:"Finder", procID:610, name:"GitHub", position:{249, 151}, size:{920, 436}}, {procName:"UTM", procID:1336, name:"UTM – browser-os", position:{142, 126}, size:{1209, 668}}, {procName:"Terminal", procID:5075, name:"Termius - New Tab", position:{0, 38}, size:{1512, 879}}}`;
      
      const result = parseWindowList(output);
      
      expect(result.length).toBe(3);
      
      // Test first window
      expect(result[0].appName).toBe('Finder');
      expect(result[0].pid).toBe(610);
      expect(result[0].title).toBe('GitHub');
      expect(result[0].bounds).toEqual({ x: 249, y: 151, width: 920, height: 436 });
      expect(result[0].id).toBeDefined();

      // Test second window
      expect(result[1].appName).toBe('UTM');
      expect(result[1].pid).toBe(1336);
      expect(result[1].title).toBe('UTM – browser-os');
      expect(result[1].bounds).toEqual({ x: 142, y: 126, width: 1209, height: 668 });
      expect(result[1].id).toBeDefined();
      
      // Test third window
      expect(result[2].appName).toBe('Terminal');
      expect(result[2].pid).toBe(5075);
      expect(result[2].title).toBe('Termius - New Tab');
      expect(result[2].bounds).toEqual({ x: 0, y: 38, width: 1512, height: 879 });
      expect(result[2].id).toBeDefined();
    });

    it('should parse the specific example output', () => {
      const output = `{{procName:"Finder", procID:610, name:"GitHub", position:{249, 151}, size:{920, 436}}, {procName:"UTM", procID:1336, name:"UTM – browser-os", position:{142, 126}, size:{1209, 668}}, {procName:"Termius", procID:5075, name:"Termius - New Tab", position:{0, 38}, size:{1512, 879}}, {procName:"Google Chrome", procID:5611, name:"nodejs get list of active windows in mac - Google Search - Google Chrome", position:{0, 38}, size:{1512, 879}}, {procName:"WhatsApp", procID:5824, name:"‎WhatsApp", position:{0, 38}, size:{1512, 879}}, {procName:"Preview", procID:6266, name:"_ 12 Node.js Design Patterns Design and implement - Third Edition [BooxRack].pdf – Page 97 of 661", position:{698, 38}, size:{987, 843}}, {procName:"Safari", procID:34641, name:"Netflix", position:{18, 38}, size:{774, 555}}, {procName:"System Settings", procID:46250, name:"Accessibility", position:{793, 166}, size:{715, 643}}, {procName:"Electron", procID:54286, name:"test.applescript — screenshot-mcp-server", position:{0, 38}, size:{1512, 879}}, {procName:"Terminal", procID:61362, name:"screenshot-mcp-server — osascript -e tell application \\"System Events\\"\\012        set allWindows to {}\\012        set allProcesses to processes whose background only is false\\012        repeat with proc in allProcesses\\012          set procName to name of proc\\012          set procID to unix id of proc\\012          set windowList to windows of proc\\012          repeat with win in windowList\\012            set winName to name of win\\012            set winPos to position of win\\012            set winSize to size of win\\012            set end of allWindows to {procName:procName, procID:procID, name:winName, position:winPos, size:winSize}\\012          end repeat\\012        end repeat\\012        return allWindows\\012      end tell -ss — 80×24", position:{935, 223}, size:{570, 371}}, {procName:"GitHub Desktop", procID:62668, name:"GitHub Desktop", position:{0, 38}, size:{1512, 868}}}`; 

      const result = parseWindowList(output);
      
      expect(result.length).toBe(11);
      
      // Check a few key entries
      expect(result[0].appName).toBe('Finder');
      expect(result[0].title).toBe('GitHub');
      
      expect(result[3].appName).toBe('Google Chrome');
      expect(result[3].pid).toBe(5611);
      
      expect(result[6].appName).toBe('Safari');
      expect(result[6].title).toBe('Netflix');
      expect(result[6].bounds.width).toBe(774);
      
      expect(result[10].appName).toBe('GitHub Desktop');
      expect(result[10].bounds.height).toBe(868);
    });

    it('should handle malformed output gracefully', () => {
      const output = `{procName:"Broken, procID:1234, incomplete data}`;
      expect(parseWindowList(output)).toEqual([]);
    });
  });
});
