#!/usr/bin/env node

import {
  checkPermissions,
  showPermissionInstructions,
} from "./utils/permissions";

/**
 * Permission Check Script
 * This script checks if your terminal/application has the required permissions
 * to run the MCP server which needs Screen Recording and Accessibility permissions.
 */
async function main(): Promise<void> {
  console.log("===================================");
  console.log("   MCP Server Permission Check");
  console.log("===================================");

  console.log("\nChecking required permissions...");

  const permissions = await checkPermissions();
  showPermissionInstructions(permissions);

  if (!permissions.screenRecording || !permissions.accessibility) {
    console.log(
      "\n‼️ Missing required permissions. Please grant the permissions listed above and run this script again.\n"
    );
    process.exit(1);
  } else {
    console.log(
      "\n✅ All required permissions are granted! You can now run the MCP server.\n"
    );
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Error running permission check:", error);
  process.exit(1);
});
