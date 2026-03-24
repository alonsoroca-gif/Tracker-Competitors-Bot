/**
 * Demo signals for Lead-to-Lease (L2L) and EliseAI. Used for first run without real feeds.
 */
function getDemoSignals() {
  const today = new Date();
  const d = (daysAgo) => {
    const d2 = new Date(today);
    d2.setDate(d2.getDate() - daysAgo);
    return d2.toISOString().slice(0, 10);
  };
  return [
    { date: d(2), source: 'blog', competitor_id: 'eliseai', product_id: 'L2L', type: 'blog', snippet: 'Launched 24/7 live chat support.' },
    { date: d(4), source: 'pricing', competitor_id: 'eliseai', product_id: 'L2L', type: 'pricing', snippet: 'New tier "Pro" at $49/mo; "no credit card required" and "cancel anytime" highlighted.' },
    { date: d(5), source: 'careers', competitor_id: 'eliseai', product_id: 'L2L', type: 'job', snippet: 'Job posting: VP Product – growth and international.' },
  ];
}

module.exports = { getDemoSignals };
