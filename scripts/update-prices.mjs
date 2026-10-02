import { readFile, writeFile } from 'node:fs/promises';

// Set PRICE_FEED_URL to a permitted retailer/aggregator JSON feed.
// Required shape: { products: [{ id, price, retailer, url? }] }.
const feedUrl = process.env.PRICE_FEED_URL;
if (!feedUrl) throw new Error('PRICE_FEED_URL is required. Use an authorised price feed or retailer API.');

const [current, response] = await Promise.all([
  readFile(new URL('../data/products.json', import.meta.url), 'utf8').then(JSON.parse),
  fetch(feedUrl, { headers: { Accept: 'application/json' } })
]);
if (!response.ok) throw new Error(`Price feed returned ${response.status}`);
const incoming = await response.json();
const byId = new Map(incoming.products.map(product => [product.id, product]));
current.products = current.products.map(product => {
  const update = byId.get(product.id);
  return update && Number.isFinite(update.price) ? { ...product, ...update, price: Number(update.price) } : product;
});
current.updatedAt = new Date().toISOString();
await writeFile(new URL('../data/products.json', import.meta.url), `${JSON.stringify(current, null, 2)}\n`);
