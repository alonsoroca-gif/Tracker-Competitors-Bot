#!/usr/bin/env node

/**
 * Script to refresh the local Domo data cache
 * Usage: npx tsx refresh-data.ts [dataset-id]
 *   - No argument: refresh all datasets
 *   - dataset-id (jira, zendesk): refresh specific dataset
 */

import { DomoClient } from './src/domo-client.js';
import { getAllDatasets, getDatasetById } from './src/dataset-config.js';
import { writeFileSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DOMO_CLIENT_ID = '9ee50b68-5c1a-4760-87d4-849915e4b68b';
const DOMO_CLIENT_SECRET = 'ce5d325f7533023e8959de0713f159d5f40211f84c5a61fde60a7754806b79d0';

async function refreshData() {
  try {
    const datasetId = process.argv[2];
    const dataDir = join(homedir(), '.domo-mcp');
    
    try {
      mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const datasetsToRefresh = datasetId 
      ? [getDatasetById(datasetId)!].filter(Boolean)
      : getAllDatasets();
    
    if (datasetsToRefresh.length === 0) {
      console.error(`❌ Unknown dataset: ${datasetId}`);
      console.error(`   Available: ${getAllDatasets().map(d => d.id).join(', ')}`);
      process.exit(1);
    }
    
    console.log(`🔄 Refreshing ${datasetsToRefresh.length} dataset(s)...\n`);
    
    // Migrate old data.csv to jira-data.csv if it exists
    if (!datasetId || datasetId === 'jira') {
      const oldDataPath = join(dataDir, 'data.csv');
      const newDataPath = join(dataDir, 'jira-data.csv');
      const { existsSync, renameSync } = await import('fs');
      if (existsSync(oldDataPath) && !existsSync(newDataPath)) {
        console.log('📦 Migrating old data.csv to jira-data.csv...');
        renameSync(oldDataPath, newDataPath);
      }
    }
    
    for (const dataset of datasetsToRefresh) {
      try {
        console.log(`📥 Downloading ${dataset.name} (${dataset.id})...`);
        const client = new DomoClient(DOMO_CLIENT_ID, DOMO_CLIENT_SECRET, dataset.datasetId);
        
        // For very large files, stream directly to disk
        const dataPath = join(dataDir, dataset.filePath);
        console.log(`💾 Streaming to ${dataset.filePath}...`);
        
        // Use the client's internal method to get streaming response
        await (client as any).ensureToken();
        const url = `https://api.domo.com/v1/datasets/${dataset.datasetId}/data?includeHeader=true`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${client.getAccessToken()}`,
            'Accept': 'text/csv',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get dataset data: ${response.status} ${errorText}`);
        }

        // Stream response to file
        const { createWriteStream } = await import('fs');
        const { pipeline } = await import('stream/promises');
        const fileStream = createWriteStream(dataPath);
        
        if (response.body) {
          await pipeline(response.body as any, fileStream);
        } else {
          throw new Error('Response body is null');
        }
        
        const stats = statSync(dataPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`   ✅ ${dataset.name}: ${fileSizeMB} MB, updated ${stats.mtime.toLocaleString()}\n`);
      } catch (error: any) {
        console.error(`   ❌ Error refreshing ${dataset.name}: ${error.message}\n`);
      }
    }
    
    console.log(`✅ Refresh complete! ${datasetsToRefresh.length} dataset(s) updated.`);
    console.log(`💡 Your cache is now up to date. Queries will use this local data.`);
    
  } catch (error: any) {
    console.error('❌ Error refreshing data:', error.message);
    console.error(error);
    process.exit(1);
  }
}

refreshData();
