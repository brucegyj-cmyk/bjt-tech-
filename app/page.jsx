'use client';

import { useEffect, useMemo, useState } from 'react';

const money = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' });
const filters = ['All', 'Memory', 'SSD', 'Graphics card', 'AMD CPU'];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [updatedAt, setUpdatedAt] = useState('Loading latest price snapshot…');
  const [activeFilter, setActiveFilter] = useState('All');
  const [watchlist, setWatchlist] = useState([]);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(window.localStorage.getItem('bjt-watchlist') || '[]');
    setWatchlist(saved);

    fetch('/data/products.json')
      .then((response) => response.json())
      .then((data) => {
        setProducts(data.products);
        const formattedDate = new Intl.DateTimeFormat('en-NZ', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Pacific/Auckland',
        }).format(new Date(data.updatedAt));
        setUpdatedAt(`Snapshot: ${formattedDate} NZST`);
      })
      .catch(() => setHasError(true));
  }, []);

  const visibleProducts = useMemo(
    () => activeFilter === 'All' ? products : products.filter((product) => product.category === activeFilter),
    [activeFilter, products],
  );
  const savedProducts = products.filter((product) => watchlist.includes(product.id));

  function toggleWatch(productId) {
    const nextWatchlist = watchlist.includes(productId)
      ? watchlist.filter((id) => id !== productId)
      : [...watchlist, productId];
    setWatchlist(nextWatchlist);
    window.localStorage.setItem('bjt-watchlist', JSON.stringify(nextWatchlist));
  }

  function chooseCategory(category) {
    setActiveFilter(category);
    document.querySelector('#deals')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <div className="announcement"><span className="pulse" /> NZ component prices checked daily <span>•</span> GST included where listed</div>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="BJT TECH home"><span className="brand-mark">B</span><span>BJT<span className="accent">.</span>TECH</span></a>
        <nav aria-label="Product categories">
          {filters.slice(1).map((category) => <a href="#deals" key={category} onClick={() => chooseCategory(category)}>{category === 'Graphics card' ? 'Graphics cards' : category}</a>)}
        </nav>
        <button className="watchlist" type="button" aria-label="Open watchlist" onClick={() => setIsWatchlistOpen(true)}>Watchlist <span>{watchlist.length}</span></button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">NEW ZEALAND / PC COMPONENT TRACKER</p>
            <h1>Build sharper.<br /><em>Spend smarter.</em></h1>
            <p className="hero-text">The clean way to see sharp PC-part pricing across the NZ market. Five tracked deals, refreshed each day.</p>
            <div className="hero-actions"><a className="button primary" href="#deals">See today’s picks <span>↓</span></a><a className="button ghost" href="#how-it-works">How prices work</a></div>
            <div className="hero-stats"><span><strong>04</strong> key categories</span><span><strong>05</strong> price picks</span><span><strong>24h</strong> refresh cycle</span></div>
          </div>
          <div className="hero-art" aria-hidden="true"><div className="hero-glow" /><div className="chip-label">BJT<br />PRICE<br />SCAN</div></div>
        </section>

        <section className="deal-section" id="deals">
          <div className="section-heading"><div><p className="eyebrow">MARKET SNAPSHOT</p><h2>Today’s sharpest tracked prices.</h2></div><p className="updated">{updatedAt}</p></div>
          <div className="filters" role="tablist" aria-label="Filter deals">
            {filters.map((filter) => <button className={`filter ${activeFilter === filter ? 'active' : ''}`} data-filter={filter} key={filter} type="button" onClick={() => setActiveFilter(filter)}>{filter === 'All' ? <>All deals <span>05</span></> : filter}</button>)}
          </div>
          <div className="deal-grid" aria-live="polite">
            {hasError ? <p>Price snapshot is unavailable. Please refresh in a moment.</p> : visibleProducts.map((product) => <article className="deal-card" key={product.id}>
              <div className={`product-art ${product.art}`} /><span className="badge">{product.category}</span><h3>{product.name}</h3><p className="spec">{product.spec}</p>
              <div className="price-row"><strong>{money.format(product.price)}</strong><span>from<br />{product.retailer}</span></div>
              <div className="card-actions"><a className="source-link" href={product.url} target="_blank" rel="noreferrer">Compare source ↗</a><button className={`save-deal ${watchlist.includes(product.id) ? 'saved' : ''}`} type="button" onClick={() => toggleWatch(product.id)}>{watchlist.includes(product.id) ? 'Saved' : 'Watch +'}</button></div>
            </article>)}
            {!hasError && products.length > 0 && visibleProducts.length === 0 && <p>No tracked deal in this category today.</p>}
          </div>
          <p className="price-note">Prices are market snapshots, not an offer from BJT TECH. Check the retailer page for delivery, stock and final price before buying.</p>
        </section>

        <section className="how-it-works" id="how-it-works">
          <p className="eyebrow">A BETTER BENCHMARK</p>
          <div className="workflow-heading"><h2>Price intelligence<br />without the noise.</h2><p>BJT TECH tracks comparable parts, surfaces the lowest listed price, and preserves the source link so you can make the final call.</p></div>
          <div className="steps"><article><span>01</span><h3>Collect</h3><p>Approved NZ retailer feeds are collected into one structured price list.</p></article><article><span>02</span><h3>Compare</h3><p>Products are matched by model and specification, not only by title.</p></article><article><span>03</span><h3>Refresh</h3><p>A scheduled daily run updates the published snapshot and timestamp.</p></article></div>
        </section>
      </main>

      <footer><a className="brand" href="#top"><span className="brand-mark">B</span><span>BJT<span className="accent">.</span>TECH</span></a><p>NZ PC parts, made easier to compare.</p><p>© {new Date().getFullYear()} BJT TECH</p></footer>
      {isWatchlistOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setIsWatchlistOpen(false)}><section className="watch-dialog" role="dialog" aria-modal="true" aria-label="Your saved deals" onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" type="button" aria-label="Close" onClick={() => setIsWatchlistOpen(false)}>×</button><p className="eyebrow">WATCHLIST</p><h2>Your saved deals</h2>{savedProducts.length ? <div>{savedProducts.map((product) => <div className="watch-item" key={product.id}><span>{product.name}</span><strong>{money.format(product.price)}</strong></div>)}</div> : <p className="dialog-empty">Save a deal to watch its next price update.</p>}</section></div>}
    </>
  );
}
