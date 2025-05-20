#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Runs the specific AppleScript commands that are used in the application
 * to test if they have permissions
 */
async function runDetailedPermissionCheck(): Promise<void> {
  console.log('===================================');
  console.log('   Thorough Accessibility Permission Check');
  console.log('===================================');
  
  console.log('\nRunning the exact AppleScript commands used in the application...');
  
  try {
    // Test listing all windows (used in WindowManager.getWindows)
    console.log('\nTesting window list access...');
    const windowListScript = `
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
    
    await execPromise(`osascript -e '${windowListScript}' -ss`);
    console.log('✅ Window list access: Permitted');
  } catch (error) {
    console.error('❌ Window list access: Not permitted');
    console.error(`Error: ${(error as any).stderr}`);
  }
  
  try {
    // Test getting active window (used in WindowManager.getActiveWindow)
    console.log('\nTesting active window access...');
    const activeWindowScript = `
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
    
    await execPromise(`osascript -e '${activeWindowScript}' -ss`);
    console.log('✅ Active window access: Permitted');
  } catch (error) {
    console.error('❌ Active window access: Not permitted');
    console.error(`Error: ${(error as any).stderr}`);
  }
  
  console.log('\nPermission check complete.');
  console.log('\nIf any checks failed, you need to:');
  console.log('1. Open System Preferences > Security & Privacy > Privacy');
  console.log('2. Select "Accessibility" from the sidebar');
  console.log('3. Click the lock icon to make changes');
  console.log('4. Find Terminal or your application in the list');
  console.log('5. Make sure it\'s checked (enabled)');
  console.log('6. If not present, add it by clicking the + button');
  console.log('7. You may need to restart Terminal or your application after making changes');
}

// Run the detailed permission check
runDetailedPermissionCheck().catch(console.error);
