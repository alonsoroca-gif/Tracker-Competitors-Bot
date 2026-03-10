#!/usr/bin/env node
/**
 * Tracker Bot — entry point.
 * Run: node index.js          → print "Tracker" (smoke)
 * Run: node index.js collect → run collect step for configured products/competitors
 */

const { loadConfig } = require('./lib/loadConfig');
const { collect } = require('./lib/collect');

const command = process.argv[2];

if (command === 'collect') {
  (async () => {
    const config = loadConfig();
    for (const product of config.products) {
      for (const competitor of config.competitors) {
        const signals = await collect(competitor.id, product.id, 7);
        console.log(`Collected ${signals.length} signals for ${competitor.name} / ${product.id}`);
        if (signals.length > 0) console.log(JSON.stringify(signals[0], null, 2));
      }
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
  return;
}

// Default: smoke
console.log('Tracker');
