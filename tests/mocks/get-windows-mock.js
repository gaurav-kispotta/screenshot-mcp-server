// Mock for the get-windows ESM module
const openWindows = jest.fn().mockResolvedValue([]);
const activeWindow = jest.fn().mockResolvedValue(null);
const openWindowsSync = jest.fn().mockReturnValue([]);
const activeWindowSync = jest.fn().mockReturnValue(null);

export { openWindows, activeWindow, openWindowsSync, activeWindowSync };
