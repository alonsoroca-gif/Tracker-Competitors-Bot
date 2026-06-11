#!/usr/bin/env node

/**
 * Test script to verify Domo MCP can pull data
 */

import { DomoClient } from './src/domo-client.js';

// Dev credentials (from index.ts)
const DOMO_CLIENT_ID = '9ee50b68-5c1a-4760-87d4-849915e4b68b';
const DOMO_CLIENT_SECRET = 'ce5d325f7533023e8959de0713f159d5f40211f84c5a61fde60a7754806b79d0';
const DOMO_DATASET_ID = '120454dd-a8ff-4ab9-bf55-fae5c2e87852';

async function testDomo() {
  console.log('🚀 Testing Domo MCP Data Retrieval...\n');
  
  const client = new DomoClient(DOMO_CLIENT_ID, DOMO_CLIENT_SECRET, DOMO_DATASET_ID);

  try {
    // Test 1: Get dataset info
    console.log('📊 Test 1: Getting dataset info...');
    const info = await client.getDatasetInfo();
    console.log('✅ Dataset Info Retrieved:');
    console.log(JSON.stringify(info, null, 2));
    console.log('\n');

    // Test 2: Execute a simple query
    console.log('🔍 Test 2: Executing SQL query (SELECT * LIMIT 5)...');
    const queryResult = await client.executeQuery('SELECT * FROM table LIMIT 5');
    console.log('✅ Query Results:');
    console.log(`Columns: ${queryResult.columns.join(', ')}`);
    console.log(`Row count: ${queryResult.rows.length}`);
    if (queryResult.rows.length > 0) {
      console.log('First row:', queryResult.rows[0]);
    }
    console.log('\n');

    // Test 3: Get dataset data as CSV (first 1000 chars)
    console.log('📥 Test 3: Getting dataset data as CSV (showing first 1000 chars)...');
    const csv = await client.getDatasetData(true);
    console.log('✅ CSV Data Retrieved:');
    console.log(csv.substring(0, 1000));
    if (csv.length > 1000) {
      console.log(`\n... (truncated, total length: ${csv.length} chars)`);
    }
    console.log('\n');

    console.log('✅ All tests passed! Domo MCP is working correctly.');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testDomo();
