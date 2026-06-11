#!/usr/bin/env node

/**
 * Persistent query server - keeps CSV data in memory
 * Usage: 
 *   Start: npx tsx query-server.ts
 *   Query: echo 'SELECT * FROM table LIMIT 5' | nc localhost 3000
 *   Or use: curl -X POST http://localhost:3000/query -d '{"sql":"SELECT * FROM table LIMIT 5"}'
 */

import { CSVQueryEngine } from './src/csv-query-engine.js';
import { join } from 'path';
import { homedir } from 'os';
import { createServer } from 'http';

const dataPath = join(homedir(), '.domo-mcp', 'data.csv');
const engine = new CSVQueryEngine(dataPath);

console.log('🔄 Loading CSV data into memory...');
const startTime = Date.now();

// Pre-load the data
engine.executeQuery('SELECT * FROM table LIMIT 1').then(() => {
  const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Data loaded in ${loadTime}s. Server ready on port 3000\n`);
});

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/query') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { sql } = JSON.parse(body);
        if (!sql) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'SQL query required' }));
          return;
        }

        const queryStart = Date.now();
        const result = await engine.executeQuery(sql);
        const queryTime = ((Date.now() - queryStart) / 1000).toFixed(3);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          columns: result.columns,
          rowCount: result.rows.length,
          rows: result.rows,
          queryTime: `${queryTime}s`,
        }, null, 2));
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }, null, 2));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3000, () => {
  console.log('📡 Query server listening on http://localhost:3000');
  console.log('   POST /query with {"sql":"YOUR QUERY"}');
});
