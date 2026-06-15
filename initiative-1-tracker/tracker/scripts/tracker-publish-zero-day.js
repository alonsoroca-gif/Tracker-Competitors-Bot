#!/usr/bin/env node
/**
 * @deprecated Use tracker-publish-intel.js — kept as alias for scripts/docs that reference zero-day.
 */
const { main } = require('./tracker-publish-intel.js');

if (require.main === module) {
  main();
}

module.exports = { main };
