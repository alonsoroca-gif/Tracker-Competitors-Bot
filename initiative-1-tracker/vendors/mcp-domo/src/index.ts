#!/usr/bin/env node

/**
 * Domo MCP Server
 * Provides tools to query Domo datasets via OAuth API
 * Uses local CSV caching to avoid hitting the API on every query
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DomoClient } from './domo-client.js';
import { MultiDatasetEngine } from './multi-dataset-engine.js';
import { DatasetConfig, getAllDatasets, getDatasetById, getDatasetByDomoId } from './dataset-config.js';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { homedir } from 'os';
import { join } from 'path';

// Dev credentials (hardcoded for now)
const DOMO_CLIENT_ID = '9ee50b68-5c1a-4760-87d4-849915e4b68b';
const DOMO_CLIENT_SECRET = 'ce5d325f7533023e8959de0713f159d5f40211f84c5a61fde60a7754806b79d0';

// Initialize multi-dataset query engine
const dataDir = join(homedir(), '.domo-mcp');
const multiEngine = new MultiDatasetEngine(dataDir);

// Ensure data directory exists
try {
  mkdirSync(dataDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore
}

// Create MCP server
const server = new Server(
  {
    name: 'domo-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'domo_query',
        description: 'Execute a SQL query on one or more locally cached Domo datasets. Queries run against cached CSV files, not the API. Use dataset parameter to query specific dataset, or omit for cross-dataset query.',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'SQL query to execute (e.g., "SELECT * FROM table LIMIT 10", "SELECT * FROM table WHERE Status = \'New\' LIMIT 20")',
            },
            dataset: {
              type: 'string',
              description: 'Dataset ID to query (jira, zendesk, or omit for cross-dataset). Available: jira, zendesk',
              enum: ['jira', 'zendesk'],
            },
            datasets: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of dataset IDs for cross-dataset queries (e.g., ["jira", "zendesk"])',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'domo_refresh_data',
        description: 'Download the latest dataset(s) from Domo and save locally. Run once a day to keep cache fresh. Can refresh one dataset or all datasets.',
        inputSchema: {
          type: 'object',
          properties: {
            dataset: {
              type: 'string',
              description: 'Dataset ID to refresh (jira, zendesk, or omit to refresh all). Available: jira, zendesk',
              enum: ['jira', 'zendesk'],
            },
            includeHeader: {
              type: 'boolean',
              description: 'Whether to include column headers in the CSV output',
              default: true,
            },
          },
        },
      },
      {
        name: 'domo_get_cache_info',
        description: 'Get information about all locally cached datasets (file paths, last modified times, row counts, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            dataset: {
              type: 'string',
              description: 'Dataset ID to get info for (jira, zendesk, or omit for all). Available: jira, zendesk',
              enum: ['jira', 'zendesk'],
            },
          },
        },
      },
      {
        name: 'domo_list_datasets',
        description: 'List all available datasets and their configuration',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'domo_get_info',
        description: 'Get metadata about the dataset from Domo API (name, description, schema, etc.). This still hits the API.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'domo_query': {
        const sql = args?.sql as string;
        if (!sql) {
          throw new Error('SQL query is required');
        }
        
        const datasetId = args?.dataset as string | undefined;
        const datasetIds = args?.datasets as string[] | undefined;
        
        let result;
        
        if (datasetId) {
          // Query specific dataset
          result = await multiEngine.executeQuery(datasetId, sql);
        } else if (datasetIds && datasetIds.length > 0) {
          // Query multiple specific datasets
          result = await multiEngine.executeCrossDatasetQuery(sql, datasetIds);
        } else {
          // Cross-dataset query (all datasets)
          result = await multiEngine.executeCrossDatasetQuery(sql);
        }
        
        // Format result for better readability
        const formatted = {
          dataset: result.dataset || (datasetId || (datasetIds ? datasetIds.join(', ') : 'all')),
          columns: result.columns,
          rowCount: result.rows.length,
          rows: result.rows,
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatted, null, 2),
            },
          ],
        };
      }

      case 'domo_refresh_data': {
        const includeHeader = args?.includeHeader !== false;
        const datasetId = args?.dataset as string | undefined;
        
        const datasetsToRefresh = datasetId 
          ? [getDatasetById(datasetId)!]
          : getAllDatasets();
        
        if (datasetsToRefresh.length === 0) {
          throw new Error('No datasets found to refresh');
        }
        
        const results = [];
        
        for (const dataset of datasetsToRefresh) {
          try {
            // Create Domo client for this dataset
            const client = new DomoClient(DOMO_CLIENT_ID, DOMO_CLIENT_SECRET, dataset.datasetId);
            
            // Download data from Domo API
            const csv = await client.getDatasetData(includeHeader);
            
            // Save to local file
            const filePath = join(dataDir, dataset.filePath);
            writeFileSync(filePath, csv, 'utf-8');
            
            // Clear cache for this dataset
            const engine = (multiEngine as any).getEngine(dataset.id);
            if (engine) {
              (engine as any).cache = null;
            }
            
            const stats = engine?.getStats() || { rowCount: 0, columnCount: 0, lastModified: null };
            
            results.push({
              dataset: dataset.id,
              name: dataset.name,
              filePath,
              rowCount: stats.rowCount,
              columnCount: stats.columnCount,
              lastModified: stats.lastModified?.toISOString(),
            });
          } catch (error: any) {
            results.push({
              dataset: dataset.id,
              name: dataset.name,
              error: error.message,
            });
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `Refreshed ${results.length} dataset(s)`,
                results,
              }, null, 2),
            },
          ],
        };
      }

      case 'domo_get_cache_info': {
        const datasetId = args?.dataset as string | undefined;
        
        if (datasetId) {
          const dataset = getDatasetById(datasetId);
          if (!dataset) {
            throw new Error(`Unknown dataset: ${datasetId}`);
          }
          
          const engine = (multiEngine as any).getEngine(datasetId);
          const stats = engine?.getStats() || { rowCount: 0, columnCount: 0, lastModified: null };
          const hasData = multiEngine.hasCachedData(datasetId);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  dataset: datasetId,
                  name: dataset.name,
                  hasCachedData: hasData,
                  filePath: join(dataDir, dataset.filePath),
                  rowCount: stats.rowCount,
                  columnCount: stats.columnCount,
                  lastModified: stats.lastModified?.toISOString() || null,
                }, null, 2),
              },
            ],
          };
        } else {
          // Get info for all datasets
          const allStats = multiEngine.getStats();
          const datasets = getAllDatasets().map(d => ({
            id: d.id,
            name: d.name,
            filePath: join(dataDir, d.filePath),
            ...allStats.find(s => s.dataset === d.id),
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  datasets,
                }, null, 2),
              },
            ],
          };
        }
      }

      case 'domo_list_datasets': {
        const datasets = getAllDatasets().map(d => ({
          id: d.id,
          name: d.name,
          datasetId: d.datasetId,
          filePath: join(dataDir, d.filePath),
          hasCachedData: multiEngine.hasCachedData(d.id),
        }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                datasets,
              }, null, 2),
            },
          ],
        };
      }

      case 'domo_get_info': {
        const datasetId = args?.dataset as string | undefined;
        const dataset = datasetId ? getDatasetById(datasetId) : getAllDatasets()[0];
        
        if (!dataset) {
          throw new Error(`Unknown dataset: ${datasetId || 'default'}`);
        }
        
        const client = new DomoClient(DOMO_CLIENT_ID, DOMO_CLIENT_SECRET, dataset.datasetId);
        const info = await client.getDatasetInfo();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                dataset: dataset.id,
                name: dataset.name,
                ...info,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'domo://dataset/info',
        name: 'Dataset Info',
        description: 'Metadata about the Domo dataset',
        mimeType: 'application/json',
      },
      {
        uri: 'domo://dataset/data',
        name: 'Dataset Data',
        description: 'Full dataset as CSV',
        mimeType: 'text/csv',
      },
    ],
  };
});

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    if (uri.startsWith('domo://dataset/info')) {
      const url = new URL(uri.replace('domo://', 'http://'));
      const datasetId = url.searchParams.get('dataset') || 'jira';
      const dataset = getDatasetById(datasetId);
      
      if (!dataset) {
        throw new Error(`Unknown dataset: ${datasetId}`);
      }
      
      const client = new DomoClient(DOMO_CLIENT_ID, DOMO_CLIENT_SECRET, dataset.datasetId);
      const info = await client.getDatasetInfo();
      
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              dataset: dataset.id,
              name: dataset.name,
              ...info,
            }, null, 2),
          },
        ],
      };
    }

    if (uri.startsWith('domo://dataset/data')) {
      // Parse dataset from URI (e.g., domo://dataset/data?dataset=jira)
      const url = new URL(uri.replace('domo://', 'http://'));
      const datasetId = url.searchParams.get('dataset') || 'jira';
      const dataset = getDatasetById(datasetId);
      
      if (!dataset) {
        throw new Error(`Unknown dataset: ${datasetId}`);
      }
      
      const filePath = join(dataDir, dataset.filePath);
      
      // Return cached data if available, otherwise fetch from API
      if (multiEngine.hasCachedData(datasetId)) {
        const csv = readFileSync(filePath, 'utf-8');
        return {
          contents: [
            {
              uri,
              mimeType: 'text/csv',
              text: csv,
            },
          ],
        };
      } else {
        // Fallback to API if no cache
        const client = new DomoClient(DOMO_CLIENT_ID, DOMO_CLIENT_SECRET, dataset.datasetId);
        const csv = await client.getDatasetData(true);
        return {
          contents: [
            {
              uri,
              mimeType: 'text/csv',
              text: csv,
            },
          ],
        };
      }
    }

    throw new Error(`Unknown resource: ${uri}`);
  } catch (error: any) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Domo MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
