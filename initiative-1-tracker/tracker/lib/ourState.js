const path = require('path');
const fs = require('fs');

const OUR_STATE_FILE = path.join(__dirname, '..', 'config', 'our-state.json');

function getOurState(productId) {
  if (!fs.existsSync(OUR_STATE_FILE)) return {};
  const data = JSON.parse(fs.readFileSync(OUR_STATE_FILE, 'utf8'));
  return data[productId] || {};
}

module.exports = { getOurState };
