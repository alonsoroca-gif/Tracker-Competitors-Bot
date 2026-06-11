#!/usr/bin/env node

/**
 * Fast query client - sends query to persistent server
 * Usage: npx tsx query-fast.ts "SELECT * FROM table LIMIT 5"
 */

const sql = process.argv[2];

if (!sql) {
  console.error('Usage: npx tsx query-fast.ts "SELECT * FROM table WHERE ..."');
  process.exit(1);
}

fetch('http://localhost:3000/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql }),
})
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    console.error('\n💡 Make sure query-server.ts is running: npx tsx query-server.ts');
    process.exit(1);
  });
