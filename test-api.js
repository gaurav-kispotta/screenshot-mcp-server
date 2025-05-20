#!/usr/bin/env node
/**
 * Simple test script for the MCP Server
 * Run this script to test the API endpoints directly
 */

const http = require('http');

// Configuration
const baseUrl = 'http://localhost:3000';
const apiPath = '/api/v1';

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = baseUrl + path;
    console.log(`${method} ${url}`);
    
    const req = http.request(url, {
      method,
    }, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        let data;
        try {
          data = JSON.parse(body);
        } catch (e) {
          data = body;
        }
        
        console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ data, response: res });
        } else {
          console.error('Error response:', data);
          reject(new Error(`Request failed with status ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error making request to ${url}:`, error.message);
      reject(error);
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('=== MCP Server API Test ===');
  
  try {
    // Test 1: List Windows
    console.log('\n1. Testing windows list endpoint...');
    const windowsResult = await makeRequest(`${apiPath}/windows`);
    const windows = windowsResult.data.data;
    console.log(`Found ${windows.length} windows:`);
    windows.forEach((window, i) => {
      if (i < 5) { // Only show first 5
        console.log(`  - ${window.appName}: ${window.title} (${window.id})`);
      }
    });
    if (windows.length > 5) {
      console.log(`  ... and ${windows.length - 5} more`);
    }
    
    // Test 2: Get Active Window
    console.log('\n2. Testing active window endpoint...');
    const activeResult = await makeRequest(`${apiPath}/windows/active`);
    const activeWindow = activeResult.data.data;
    console.log(`Active window: ${activeWindow.appName}: ${activeWindow.title}`);
    
    // Test 3: Get Window By ID
    if (windows.length > 0) {
      const testWindow = windows[0];
      console.log(`\n3. Testing get window by ID (${testWindow.id})...`);
      const windowResult = await makeRequest(`${apiPath}/windows/${testWindow.id}`);
      console.log(`Retrieved window: ${windowResult.data.data.appName}: ${windowResult.data.data.title}`);
    }
    
    // Test 4: Take Screenshot of Active Window
    console.log('\n4. Testing screenshot endpoint...');
    try {
      await makeRequest(`${apiPath}/screenshots/active`);
      console.log('Screenshot captured successfully!');
    } catch (error) {
      console.error('Failed to capture screenshot:', error.message);
    }
    
    console.log('\n=== Tests completed ===');
  } catch (error) {
    console.error('\nTest failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
