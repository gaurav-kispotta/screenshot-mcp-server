import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Checks if the application has the required permissions for screen capture and window management
 */
export async function checkPermissions(): Promise<{
  screenRecording: boolean;
  accessibility: boolean;
}> {
  const results = {
    screenRecording: false,
    accessibility: false
  };

  // Check Screen Recording permission
  const testPath = path.join(os.tmpdir(), `permission-test-${Date.now()}.png`);
  try {
    await execPromise(`/usr/sbin/screencapture -x -t png -R 0,0,1,1 ${testPath}`);
    if (fs.existsSync(testPath)) {
      results.screenRecording = true;
      fs.unlinkSync(testPath);
    }
  } catch (error) {
    results.screenRecording = false;
    console.error('Screen Recording permission denied:', error);
  }
  
  // Check Accessibility permission with an AppleScript test
  try {
    await execPromise(`osascript -e 'tell application "System Events" to get name of first application process'`);
    results.accessibility = true;
  } catch (error) {
    results.accessibility = false;
    console.error('Accessibility permission denied:', error);
  }

  return results;
}

/**
 * Shows instructions for enabling required permissions
 */
export function showPermissionInstructions(
  permissions: { screenRecording: boolean; accessibility: boolean }
): void {
  console.log('\n=== Required Permissions ===');
  
  if (!permissions.screenRecording) {
    console.log('\n❌ Screen Recording permission is NOT granted');
    console.log('To enable:');
    console.log('1. Open System Preferences > Security & Privacy > Privacy');
    console.log('2. Select "Screen Recording" from the left sidebar');
    console.log('3. Click the lock icon and enter your password to make changes');
    console.log('4. Add Terminal or your application and ensure it\'s checked');
    console.log('5. Restart Terminal or your application');
  } else {
    console.log('✅ Screen Recording permission: Granted');
  }
  
  if (!permissions.accessibility) {
    console.log('\n❌ Accessibility permission is NOT granted');
    console.log('To enable:');
    console.log('1. Open System Preferences > Security & Privacy > Privacy');
    console.log('2. Select "Accessibility" from the left sidebar');
    console.log('3. Click the lock icon and enter your password to make changes');
    console.log('4. Add Terminal or your application and ensure it\'s checked');
    console.log('5. Restart Terminal or your application');
  } else {
    console.log('✅ Accessibility permission: Granted');
  }
}

// Helper function to promisify exec
function execPromise(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
