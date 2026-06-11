#!/usr/bin/env node

/**
 * Reusable query script - takes SQL and optional dataset as arguments
 * Usage: 
 *   npx tsx query.ts "SELECT * FROM table WHERE ..." [dataset-id]
 *   npx tsx query.ts "SELECT * FROM table WHERE ..." jira
 *   npx tsx query.ts "SELECT * FROM table WHERE ..." zendesk
 * 
 * IMPORTANT: This script is READ-ONLY. It only reads from CSV files.
 * The CSV files are never modified by queries. Only domo_refresh_data updates them.
 */

import { MultiDatasetEngine } from './src/multi-dataset-engine.js';
import { getAllDatasets } from './src/dataset-config.js';
import { join } from 'path';
import { homedir } from 'os';

async function runQuery() {
  const sql = process.argv[2];
  const datasetId = process.argv[3];
  
  if (!sql) {
    console.error('Usage: npx tsx query.ts "SELECT * FROM table WHERE ..." [dataset-id]');
    console.error(`   Available datasets: ${getAllDatasets().map(d => d.id).join(', ')}`);
    console.error('   Omit dataset-id for cross-dataset query');
    process.exit(1);
  }

  const dataDir = join(homedir(), '.domo-mcp');
  const engine = new MultiDatasetEngine(dataDir);

  try {
    let result;
    
    if (datasetId) {
      // Query specific dataset
      result = await engine.executeQuery(datasetId, sql);
    } else {
      // Cross-dataset query
      result = await engine.executeCrossDatasetQuery(sql);
    }
    
    // Output as JSON for easy parsing
    console.log(JSON.stringify({
      dataset: result.dataset || datasetId || 'all',
      columns: result.columns,
      rowCount: result.rows.length,
      rows: result.rows,
    }, null, 2));
    
  } catch (error: any) {
    console.error(JSON.stringify({
      error: error.message,
    }, null, 2));
    process.exit(1);
  }
}

runQuery();
