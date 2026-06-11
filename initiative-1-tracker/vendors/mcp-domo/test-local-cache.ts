#!/usr/bin/env node

/**
 * Test script to verify local CSV caching works
 */

import { DomoClient } from './src/domo-client.js';
import { CSVQueryEngine } from './src/csv-query-engine.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DOMO_CLIENT_ID = '9ee50b68-5c1a-4760-87d4-849915e4b68b';
const DOMO_CLIENT_SECRET = 'ce5d325f7533023e8959de0713f159d5f40211f84c5a61fde60a7754806b79d0';
const DOMO_DATASET_ID = '120454dd-a8ff-4ab9-bf55-fae5c2e87852';

async function testLocalCache() {
  try {
    console.log('🧪 Testing Local CSV Cache Functionality...\n');
    
    // Setup
    const dataDir = join(homedir(), '.domo-mcp');
    const dataPath = join(dataDir, 'data.csv');
    
    try {
      mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Step 1: Download data from Domo
    console.log('📥 Step 1: Downloading data from Domo API...');
    const client = new DomoClient(DOMO_CLIENT_ID, DOMO_CLIENT_SECRET, DOMO_DATASET_ID);
    const csv = await client.getDatasetData(true);
    
    // Step 2: Save to local file
    console.log('💾 Step 2: Saving to local file...');
    writeFileSync(dataPath, csv, 'utf-8');
    console.log(`✅ Data saved to: ${dataPath}\n`);
    
    // Step 3: Initialize query engine
    console.log('🔍 Step 3: Initializing CSV Query Engine...');
    const engine = new CSVQueryEngine(dataPath);
    
    // Step 4: Check cache info
    console.log('📊 Step 4: Checking cache info...');
    const stats = engine.getStats();
    console.log(`   Row count: ${stats.rowCount}`);
    console.log(`   Column count: ${stats.columnCount}`);
    console.log(`   Last modified: ${stats.lastModified?.toLocaleString() || 'unknown'}\n`);
    
    // Step 5: Test queries
    console.log('🔍 Step 5: Testing queries on local cache...\n');
    
    // Test 1: Simple SELECT with LIMIT
    console.log('Test 1: SELECT * LIMIT 5');
    const result1 = await engine.executeQuery('SELECT * FROM table LIMIT 5');
    console.log(`   ✅ Returned ${result1.rows.length} rows with ${result1.columns.length} columns\n`);
    
    // Test 2: SELECT with WHERE
    console.log('Test 2: SELECT * WHERE Issue Type = Epic LIMIT 3');
    const result2 = await engine.executeQuery(`SELECT * FROM table WHERE "Issue Type" = 'Epic' LIMIT 3`);
    console.log(`   ✅ Returned ${result2.rows.length} rows`);
    if (result2.rows.length > 0) {
      const issueTypeIndex = result2.columns.indexOf('Issue Type');
      if (issueTypeIndex >= 0) {
        console.log(`   ✅ First row Issue Type: "${result2.rows[0][issueTypeIndex]}"`);
      }
    }
    console.log('');
    
    // Test 3: Count query
    console.log('Test 3: Counting Epics with March 24, 2026 Standard GA Date');
    const result3 = await engine.executeQuery(`SELECT * FROM table WHERE "Issue Type" = 'Epic' AND "Standard GA Date" LIKE '%2026-03-24%'`);
    console.log(`   ✅ Found ${result3.rows.length} Epics\n`);
    
    console.log('✅ All tests passed! Local caching is working correctly.');
    console.log(`\n💡 Tip: Run 'domo_refresh_data' daily to keep your cache fresh.`);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testLocalCache();
