# Screenshot MCP Server

A Media Control Protocol (MCP) server that captures screenshots of windows in macOS and provides them via a network interface. This tool allows remote applications to request and receive screenshots of specific windows or the entire screen.

## Features

- Capture full-screen screenshots
- Capture screenshots of specific windows by ID or title
- Capture screenshots of specific screen regions
- List all available windows
- Get window properties (position, size, title, process ID)
- Track window focus changes
- Support different image formats (PNG, JPEG, etc.)
- RESTful API and WebSocket interfaces
- Real-time window event notifications

## Requirements

- macOS 12+ (Monterey or later)
- Node.js 18+
- Screen Recording permission
- Accessibility permission

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/screenshot-mcp-server.git
cd screenshot-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Starting the Server

```bash
# Start the server on default port 3000
npm start

# Start the server on a custom port
npm start -- --port 8080
```

### API Endpoints

#### Window Management

- `GET /api/v1/windows` - List all windows
- `GET /api/v1/windows/active` - Get the active window
- `GET /api/v1/windows/:id` - Get window by ID
- `GET /api/v1/applications/:appName/windows` - Get windows by application name

#### Screenshots

- `GET /api/v1/screenshots/screen` - Capture full screen
- `GET /api/v1/screenshots/window/:id` - Capture window by ID
- `GET /api/v1/screenshots/region` - Capture specific screen region

### WebSocket API

Connect to `ws://localhost:3000` and use the following events:

- `windows:list` - Get list of all windows
- `windows:active` - Get active window
- `screenshot:capture` - Capture screenshot
- `subscribe:window_events` - Subscribe to window events

### Example

```javascript
// Connect to the WebSocket API
const socket = io('http://localhost:3000');

// Request a screenshot of the active window
socket.emit('windows:active', {}, (response) => {
  if (response.success && response.window) {
    socket.emit('screenshot:capture', {
      target: 'window',
      windowId: response.window.id,
      options: {
        format: 'png',
        quality: 90
      }
    }, (result) => {
      if (result.success) {
        // result.image contains the base64-encoded screenshot
        const imageElement = document.createElement('img');
        imageElement.src = `data:image/${result.metadata.format};base64,${result.image}`;
        document.body.appendChild(imageElement);
      }
    });
  }
});

// Subscribe to window events
socket.emit('subscribe:window_events');
socket.on('window_event', (event) => {
  console.log(`Window event: ${event.type}`, event.window);
});
```

## Permissions

This application requires:

1. **Screen Recording** permission - Required for the `screencapture` utility to function
2. **Accessibility** permission - Required for AppleScript to access window information

You will be prompted to grant these permissions when you first run the application. You can also manage permissions in System Preferences > Security & Privacy > Privacy.

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT
