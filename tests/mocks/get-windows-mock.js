// Mock for the get-windows ESM module
const getWindowsMock = {
  openWindows: jest.fn().mockResolvedValue([]),
  activeWindow: jest.fn().mockResolvedValue(null),
  openWindowsSync: jest.fn().mockReturnValue([]),
  activeWindowSync: jest.fn().mockReturnValue(null)
};

module.exports = getWindowsMock;
