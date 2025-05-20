/**
 * MCP Protocol implementation
 *
 * This module defines the protocol used for communication between clients
 * and the Screenshot MCP Server.
 */

// Request message format
export interface MCPRequest {
  requestId: string;
  action: string;
  parameters: Record<string, any>;
  authentication?: {
    token: string;
  };
}

// Response message format
export interface MCPResponse {
  requestId: string;
  status: "success" | "error";
  data?: any;
  error?: string;
}

// Screenshot request parameters
export interface CaptureScreenParams {
  display?: number;
  format?: string;
  quality?: number;
  scale?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Window capture parameters
export interface CaptureWindowParams {
  windowId: string;
  format?: string;
  quality?: number;
  scale?: number;
  noShadow?: boolean;
}

// Window list parameters
export interface WindowListParams {
  application?: string;
  onlyVisible?: boolean;
}

// Protocol action types
export enum MCPAction {
  // Window actions
  LIST_WINDOWS = "listWindows",
  GET_WINDOW = "getWindow",
  GET_ACTIVE_WINDOW = "getActiveWindow",
  FIND_WINDOW = "findWindow",

  // Screenshot actions
  CAPTURE_SCREEN = "captureScreen",
  CAPTURE_WINDOW = "captureWindow",
  CAPTURE_REGION = "captureRegion",

  // Subscription actions
  SUBSCRIBE_WINDOW_EVENTS = "subscribeWindowEvents",
  UNSUBSCRIBE_WINDOW_EVENTS = "unsubscribeWindowEvents",

  // Other actions
  PING = "ping",
}

// Helper function to create a request
export function createRequest(
  action: MCPAction,
  parameters: Record<string, any>,
  token?: string
): MCPRequest {
  return {
    requestId: generateRequestId(),
    action,
    parameters,
    ...(token ? { authentication: { token } } : {}),
  };
}

// Helper function to create a response
export function createResponse(
  requestId: string,
  success: boolean,
  data?: any,
  error?: string
): MCPResponse {
  return {
    requestId,
    status: success ? "success" : "error",
    ...(data ? { data } : {}),
    ...(error ? { error } : {}),
  };
}

// Generate a unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
