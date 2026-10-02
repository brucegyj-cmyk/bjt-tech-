const grid = document.querySelector('#dealGrid');
const updatedAt = document.querySelector('#updatedAt');
const watchlist = new Set(JSON.parse(localStorage.getItem('bjt-watchlist') || '[]'));
let products = [];

const money = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' });

function updateWatchCount() { document.querySelector('#watchCount').textContent = watchlist.size; }
function render(items) {
  grid.innerHTML = items.length ? items.map(product => `
    <article class="deal-card">
      <div class="product-art ${product.art}"></div>
      <span class="badge">${product.category}</span>
      <h3>${product.name}</h3>
      <p class="spec">${product.spec}</p>
      <div class="price-row"><strong>${money.format(product.price)}</strong><span>from<br>${product.retailer}</span></div>
      <div class="card-actions"><a class="source-link" href="${product.url}" target="_blank" rel="noreferrer">Compare source ↗</a><button class="save-deal ${watchlist.has(product.id) ? 'saved' : ''}" data-id="${product.id}">${watchlist.has(product.id) ? 'Saved' : 'Watch +'}</button></div>
    </article>`).join('') : '<p>No tracked deal in this category today.</p>';
}
async function init() {
  try {
    const response = await fetch('data/products.json');
    const data = await response.json();
    products = data.products;
    updatedAt.textContent = `Snapshot: ${new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Pacific/Auckland' }).format(new Date(data.updatedAt))} NZST`;
    render(products);
  } catch { grid.innerHTML = '<p>Price snapshot is unavailable. Please refresh in a moment.</p>'; }
}
document.querySelector('.filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]'); if (!button) return;
  document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button));
  render(button.dataset.filter === 'All' ? products : products.filter(product => product.category === button.dataset.filter));
});
document.querySelector('nav').addEventListener('click', event => {
  const link = event.target.closest('[data-category-link]'); if (!link) return;
  const button = document.querySelector(`[data-filter="${link.dataset.categoryLink}"]`); if (button) button.click();
});
grid.addEventListener('click', event => {
  const button = event.target.closest('.save-deal'); if (!button) return;
  const id = button.dataset.id; watchlist.has(id) ? watchlist.delete(id) : watchlist.add(id);
  localStorage.setItem('bjt-watchlist', JSON.stringify([...watchlist])); updateWatchCount();
  const active = document.querySelector('.filter.active').dataset.filter; render(active === 'All' ? products : products.filter(product => product.category === active));
});
const dialog = document.querySelector('#watchDialog');
document.querySelector('#watchlistButton').addEventListener('click', () => { const saved = products.filter(p => watchlist.has(p.id)); document.querySelector('#watchItems').innerHTML = saved.map(p => `<div class="watch-item"><span>${p.name}</span><strong>${money.format(p.price)}</strong></div>`).join(''); document.querySelector('#emptyWatchlist').hidden = saved.length > 0; dialog.showModal(); });
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
document.querySelector('#year').textContent = new Date().getFullYear(); updateWatchCount(); init();
