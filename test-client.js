import fetch from 'node-fetch';
import fs from 'fs';

async function main() {
  // Initialize the session
  const initResponse = await fetch('http://localhost:3000/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      id: 'init-123',
      params: {
        capabilities: {
          tools: {
            listChanged: true
          }
        }
      }
    })
  });
  
  const initData = await initResponse.json();
  console.log('Init response:', JSON.stringify(initData, null, 2));
  
  // Extract the session ID
  const sessionId = initResponse.headers.get('mcp-session-id');
  console.log('Session ID:', sessionId);
  
  // Call the screenshot tool
  const toolResponse = await fetch('http://localhost:3000/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'callTool',
      id: 'tool-123',
      params: {
        name: 'takeScreenshot',
        params: {}
      }
    })
  });
  
  const toolData = await toolResponse.json();
  console.log('Tool response:', JSON.stringify(toolData, null, 2));
  
  // The base64 image data will be in toolData.result.content[1].data
  // We'll just log the first 100 characters to keep the output manageable
  if (toolData.result && toolData.result.content && toolData.result.content[1]) {
    const imageData = toolData.result.content[1].data;
    console.log('Image data (truncated):', imageData.substring(0, 100) + '...');
    
    // Save the image to a file
    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync('screenshot.png', buffer);
    console.log('Screenshot saved to screenshot.png');
  }
}

main().catch(err => console.error('Error:', err));
