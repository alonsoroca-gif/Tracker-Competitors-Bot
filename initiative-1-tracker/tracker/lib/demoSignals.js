/**
 * Demo signals for EliseAI vs our first configured product (`prospect-portal` in products.json).
 * Use `node index.js demo` or `npm run demo` for a no-network walkthrough.
 */
function getDemoSignals() {
  const today = new Date();
  const d = (daysAgo) => {
    const d2 = new Date(today);
    d2.setDate(d2.getDate() - daysAgo);
    return d2.toISOString().slice(0, 10);
  };
  /** Must match a real `products[].id` in config/products.json (default report uses products[0]). */
  const productId = 'prospect-portal';
  return [
    {
      date: d(2),
      source: 'blog',
      competitor_id: 'eliseai',
      product_id: productId,
      type: 'blog',
      snippet: 'Launched 24/7 live chat support.',
    },
    {
      date: d(4),
      source: 'pricing',
      competitor_id: 'eliseai',
      product_id: productId,
      type: 'pricing',
      snippet: 'New tier "Pro" at $49/mo; "no credit card required" and "cancel anytime" highlighted.',
    },
    {
      date: d(5),
      source: 'careers',
      competitor_id: 'eliseai',
      product_id: productId,
      type: 'job',
      snippet: 'Job posting: VP Product – growth and international.',
    },
  ];
}

module.exports = { getDemoSignals };
