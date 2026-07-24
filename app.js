// ---- WEB AUDIO FART ----
function playFart() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const dur = 0.85;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const freq = 85 + 55 * Math.exp(-t * 4) + 18 * Math.sin(t * 38);
    d[i] = (Math.random() * 2 - 1) * 0.55 * Math.exp(-t * 3)
          + Math.sin(2 * Math.PI * freq * t) * 0.38 * Math.exp(-t * 2.4);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.75, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, dur);
  src.connect(gain); gain.connect(ctx.destination); src.start();

  ['💨','😤','🌫️','💨','🤢'].forEach((e, i) => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'puff'; el.textContent = e;
      el.style.left = (15 + Math.random() * 65) + 'vw';
      el.style.top  = (15 + Math.random() * 55) + 'vh';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    }, i * 130);
  });
}

// ---- DATE ----
document.getElementById('datebar').textContent =
  new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  + ' — Refreshes on every load';

// ---- VERDICTS ----
const STOCK_VERDICTS = [
  "Has been through worse. Probably.",
  "Down bad, but the fundamentals haven't changed.",
  "The market overreacted. At least that's the hope.",
  "Smells like an opportunity if you can hold your nose.",
  "Everyone hates it right now. Contrarian catnip.",
  "Beat up, not beaten. (Allegedly.)",
  "Technically oversold. Emotionally, who knows.",
  "The chart looks like a ski slope. Time to buy a lift ticket?",
  "Still standing. Just barely.",
  "This too shall pass. Hopefully.",
];

const CRYPTO_VERDICTS = [
  "The blockchain is crying. Probably.",
  "Web3 believers are buying this dip. Or so they claim.",
  "Down bad. But it's crypto, so who even knows.",
  "Your degenerate uncle would call this a gift.",
  "If you squint at the chart, it looks like a bottom.",
  "Oversold or just... over? That's the question.",
  "HODLers are sweating. Opportunity awaits?",
  "The vibes are terrible. The RSI agrees.",
  "Even the memes have gotten quieter.",
  "Buy the stink, sell the rally. (Not advice.)",
];

// ---- WATCHLISTS ----
const STOCK_WATCHLIST = [
  { ticker: 'AAPL',  name: 'Apple' },
  { ticker: 'MSFT',  name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'AMZN',  name: 'Amazon' },
  { ticker: 'META',  name: 'Meta' },
  { ticker: 'NVDA',  name: 'NVIDIA' },
  { ticker: 'TSLA',  name: 'Tesla' },
  { ticker: 'AMD',   name: 'AMD' },
  { ticker: 'INTC',  name: 'Intel' },
  { ticker: 'NFLX',  name: 'Netflix' },
  { ticker: 'DIS',   name: 'Disney' },
  { ticker: 'PYPL',  name: 'PayPal' },
  { ticker: 'SNAP',  name: 'Snap' },
  { ticker: 'UBER',  name: 'Uber' },
  { ticker: 'COIN',  name: 'Coinbase' },
  { ticker: 'PLTR',  name: 'Palantir' },
  { ticker: 'SHOP',  name: 'Shopify' },
  { ticker: 'NIO',   name: 'NIO' },
  { ticker: 'BABA',  name: 'Alibaba' },
  { ticker: 'PFE',   name: 'Pfizer' },
  { ticker: 'BAC',   name: 'Bank of America' },
  { ticker: 'XOM',   name: 'ExxonMobil' },
  { ticker: 'F',     name: 'Ford' },
  { ticker: 'GM',    name: 'GM' },
  { ticker: 'NKE',   name: 'Nike' },
];

const CRYPTO_WATCHLIST = [
  { ticker: 'BTC',  name: 'Bitcoin' },
  { ticker: 'ETH',  name: 'Ethereum' },
  { ticker: 'SOL',  name: 'Solana' },
  { ticker: 'XRP',  name: 'XRP' },
  { ticker: 'DOGE', name: 'Dogecoin' },
  { ticker: 'ADA',  name: 'Cardano' },
  { ticker: 'AVAX', name: 'Avalanche' },
  { ticker: 'LINK', name: 'Chainlink' },
  { ticker: 'DOT',  name: 'Polkadot' },
  { ticker: 'LTC',  name: 'Litecoin' },
];

const PROXY = 'https://fartdollar.zhodgkin14.workers.dev';
const DAYS_OF_HISTORY = 370;
const MKTCAP_TTL_MS = 24 * 60 * 60 * 1000;

function toISODate(d) { return d.toISOString().slice(0, 10); }

// The proxy forwards to Polygon and echoes Polygon's own error shape on
// entitlement/rate-limit failures rather than a non-2xx status (e.g.
// `{"status":"NOT_AUTHORIZED",...}` for endpoints the current plan doesn't
// cover — currently true for crypto, which we fetch best-effort and just
// fall back to "data unavailable" for), so `status` in the body has to be
// checked too, not just `res.ok`. A couple of quick retries covers ordinary
// network blips without needing to seriously rate-limit the client.
async function fetchJSON(url, attemptsLeft = 2) {
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === 'ERROR' || json.status === 'NOT_AUTHORIZED') return null;
    return json;
  } catch {
    if (attemptsLeft > 0) {
      await new Promise(r => setTimeout(r, 500));
      return fetchJSON(url, attemptsLeft - 1);
    }
    return null;
  }
}

function getMarketCap(ticker) {
  const key = `fd_mktcap_${ticker}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    if (cached && Date.now() - cached.ts < MKTCAP_TTL_MS) return Promise.resolve(cached.value);
  } catch { /* no usable cache entry */ }

  return fetchJSON(`${PROXY}/v3/reference/tickers/${ticker}?apiKey=proxy`).then(json => {
    const value = json?.results?.market_cap ?? null;
    try { localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() })); } catch { /* storage unavailable */ }
    return value;
  });
}

// Wilder's smoothed RSI, computed from daily closes (newest-first).
function computeRSI(closesNewestFirst, period = 14) {
  if (closesNewestFirst.length < period + 1) return null;
  const closes = closesNewestFirst.slice().reverse(); // oldest -> newest

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// Daily bars only change once a trading day, so a same-day cache turns every
// repeat visit (and every retry-heavy load) into a free hit against a proxy
// that can barely sustain a couple of requests per second.
const TICKER_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

async function fetchTicker({ ticker, name, isCrypto }) {
  const cacheKey = `fd_ticker_v1_${ticker}${isCrypto ? '_c' : ''}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && Date.now() - cached.ts < TICKER_CACHE_TTL_MS) return cached.value;
  } catch { /* no usable cache entry */ }

  const symbol = isCrypto ? `X:${ticker}USD` : ticker;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - DAYS_OF_HISTORY);

  const url = `${PROXY}/v2/aggs/ticker/${symbol}/range/1/day/${toISODate(from)}/${toISODate(to)}`
    + `?sort=desc&limit=400&adjusted=true&apiKey=proxy`;
  const json = await fetchJSON(url);
  const bars = json?.results;
  if (!bars || bars.length < 15) return null;

  const price = bars[0].c;
  const prevClose = bars[1].c;
  const change = price - prevClose;
  const changePct = (change / prevClose) * 100;
  const high52 = Math.max(...bars.map(b => b.h));
  const pctOffHigh = ((price - high52) / high52) * 100;
  const closes = bars.map(b => b.c);
  const rsi = computeRSI(closes, 14);
  const sparkCloses = closes.slice(0, 90).slice().reverse(); // oldest -> newest, for drawing

  // bars[0] can be today's still-in-progress session (this endpoint returns
  // it live during market hours), so its volume is naturally low next to a
  // full-day average — that's a clock artifact, not a real signal. Compare
  // the last *complete* session (bars[1]) against the average of the
  // complete sessions before it instead.
  const priorBars = bars.slice(1, 31);
  const avgVolume = priorBars.reduce((sum, b) => sum + b.v, 0) / priorBars.length;

  // Market cap is fetched lazily (see hydrateMarketCaps) only for tickers
  // that actually end up displayed, since it's a whole extra request per
  // stock on a proxy that can't afford one per watchlist entry up front.
  const value = {
    ticker, name, price, change, changePct, rsi, mktCap: null, high52, pctOffHigh,
    volume: bars[0].v, prevVolume: bars[1].v, avgVolume, dayHigh: bars[0].h, dayLow: bars[0].l, sparkCloses,
  };
  try { localStorage.setItem(cacheKey, JSON.stringify({ value, ts: Date.now() })); } catch { /* storage unavailable */ }
  return value;
}

function fmt(n) {
  if (!n) return '—';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return '$' + (n/1e9).toFixed(1)  + 'B';
  if (n >= 1e6)  return '$' + (n/1e6).toFixed(1)  + 'M';
  return '$' + n.toLocaleString();
}

function fmtVol(n) {
  if (!n) return '—';
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(0) + 'K';
  return n.toString();
}

function fmtPrice(p, isCrypto) {
  if (!p) return '—';
  if (isCrypto && p < 1)   return '$' + p.toFixed(4);
  if (isCrypto && p < 100) return '$' + p.toFixed(2);
  return '$' + p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getRSILabel(rsi) {
  if (rsi < 35)  return { cls: 'oversold',   label: '💩 Oversold' };
  if (rsi > 65)  return { cls: 'overbought', label: '🔥 Overbought' };
  return               { cls: 'neutral',     label: '😐 Neutral' };
}

// Builds a plain SVG sparkline from a numeric close-price series. All inputs
// are API-derived numbers run through toFixed, never raw strings, before
// they reach the markup.
function buildSparkline(closes, isCrypto) {
  if (!closes || closes.length < 2) return '';
  const w = 240, h = 36;
  const min = Math.min(...closes), max = Math.max(...closes);
  const range = max - min || 1;
  const step = w / (closes.length - 1);
  const points = closes
    .map((c, i) => `${(i * step).toFixed(1)},${(h - ((c - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const color = closes[closes.length - 1] >= closes[0]
    ? 'var(--green)'
    : (isCrypto ? 'var(--crypto-accent)' : 'var(--red)');

  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`
    + `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Compares the trailing ~10-day close average against the ~10 days before
// that (from the sparkline data already in memory) to describe direction,
// rather than just leaving "oversold" sitting there with no trend context.
function computeMomentum(sparkCloses) {
  if (!sparkCloses || sparkCloses.length < 20) return null;
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const recent = avg(sparkCloses.slice(-10));
  const prior = avg(sparkCloses.slice(-20, -10));
  const pctMove = ((recent - prior) / prior) * 100;
  if (pctMove > 3) return 'up';
  if (pctMove < -3) return 'down';
  return 'flat';
}

// Explains *why* a card is on the list using only numbers already fetched —
// no new requests. Deliberately descriptive ("RSI suggests X") rather than
// prescriptive ("buy this"), consistent with the site's own disclaimer.
function buildReasoning(stock) {
  const offHigh = Math.abs(stock.pctOffHigh).toFixed(0);
  const magnitude = `Down ${offHigh}% from its 52-week high.`;

  let rsiClause = '';
  if (stock.rsi != null) {
    const rsi = stock.rsi.toFixed(1);
    if (stock.rsi < 20) {
      rsiClause = `RSI has fallen to ${rsi}, deep oversold territory — a level that often precedes a bounce, though it can just as easily mean the selling isn't finished.`;
    } else if (stock.rsi < 35) {
      rsiClause = `RSI sits at ${rsi}, oversold by the classic 30–35 threshold technical traders watch.`;
    } else if (stock.rsi <= 65) {
      rsiClause = `RSI is a neutral ${rsi}, no strong momentum signal in either direction.`;
    } else {
      rsiClause = `RSI has climbed to ${rsi}, overbought — suggesting a recovery may already be underway.`;
    }
  }

  const momentum = computeMomentum(stock.sparkCloses);
  const momentumClause = {
    up: "The last couple weeks show it climbing back.",
    down: "The chart's still sliding heading into today.",
    flat: "It's been mostly flat the past couple weeks.",
  }[momentum] || '';

  const volRatio = stock.avgVolume ? stock.prevVolume / stock.avgVolume : null;
  const volumeClause = volRatio > 1.5
    ? "Its last full session traded well above average volume, so more attention than usual is on it."
    : (volRatio && volRatio < 0.6 ? "Its last full session traded on lighter-than-usual volume — not much conviction either way." : '');

  return [magnitude, rsiClause, momentumClause, volumeClause].filter(Boolean).join(' ');
}

function renderCard(stock, idx, isCrypto) {
  const verdicts = isCrypto ? CRYPTO_VERDICTS : STOCK_VERDICTS;
  const isUp = stock.change >= 0;
  const rsiPct = Math.min(100, Math.max(0, stock.rsi ?? 0));
  const verdict = verdicts[idx % verdicts.length];
  const cryptoClass = isCrypto ? ' crypto-card' : '';
  const { cls: rsiCls, label: rsiLabel } = getRSILabel(stock.rsi ?? 50);
  const badgeClass = isCrypto ? `${rsiCls} crypto` : rsiCls;
  const displayTicker = stock.ticker.replace('-USD', '');
  const firstMeta = isCrypto
    ? { label: 'Day Range', value: `${fmtPrice(stock.dayLow, true)}–${fmtPrice(stock.dayHigh, true)}` }
    : { label: 'Mkt Cap', value: fmt(stock.mktCap) };
  const reasoning = buildReasoning(stock);

  return `
    <div class="stock-card${cryptoClass}">
      <div class="stink-badge ${badgeClass}">${rsiLabel}</div>
      <div class="stock-ticker">${displayTicker}</div>
      <div class="stock-name">${stock.name}</div>
      <div class="stock-price-row">
        <div class="stock-price">${fmtPrice(stock.price, isCrypto)}</div>
        <div class="stock-change ${isUp ? 'up' : ''}">
          ${isUp ? '▲' : '▼'} ${Math.abs(stock.changePct).toFixed(2)}%
        </div>
      </div>
      ${buildSparkline(stock.sparkCloses, isCrypto)}
      <hr class="divider"/>
      <div class="stock-meta">
        <div class="meta-item">
          <label>${firstMeta.label}</label>
          <span>${firstMeta.value}</span>
        </div>
        <div class="meta-item">
          <label>Volume</label>
          <span>${fmtVol(stock.volume)}</span>
        </div>
        <div class="meta-item">
          <label>Off 52W High</label>
          <span>${stock.pctOffHigh.toFixed(1)}%</span>
        </div>
        <div class="meta-item">
          <label>RSI(14)</label>
          <span>${stock.rsi?.toFixed(1) ?? '—'}</span>
        </div>
        <div class="rsi-wrap">
          <div class="rsi-label-row">
            <span>Oversold</span>
            <span>Overbought</span>
          </div>
          <div class="rsi-bar">
            <div class="rsi-fill ${rsiCls}" style="width: ${rsiPct}%"></div>
          </div>
        </div>
      </div>
      <div class="reasoning">${reasoning}</div>
      <div class="verdict">${verdict}</div>
      <div class="card-footer">
        <button class="share-btn" data-ticker="${displayTicker}" data-name="${escapeAttr(stock.name)}"
          data-off-high="${stock.pctOffHigh.toFixed(1)}" data-rsi="${stock.rsi?.toFixed(1) ?? '—'}">
          📤 Share this stink
        </button>
      </div>
    </div>
  `;
}

function skeletonHTML(count) {
  return Array.from({ length: count }, () => `
    <div class="stock-card skeleton">
      <div class="skel-line skel-ticker"></div>
      <div class="skel-line skel-name"></div>
      <div class="skel-line skel-spark"></div>
      <div class="skel-line skel-price"></div>
      <div class="skel-line skel-meta"></div>
    </div>
  `).join('');
}

// gridId -> { results, isCrypto, sortMode, pending, mktCapRequested }, so the
// sort toggle can re-render from already-fetched data instead of refetching,
// and so we know which tickers are still queued behind the rate limiter.
const sectionState = {};

// Market cap is a whole extra request per stock, so it's only worth fetching
// for tickers that actually made the cut into the visible top cards — fired
// after the section renders, then patched in as each one resolves.
function hydrateMarketCaps(gridId, cards) {
  const state = sectionState[gridId];
  if (!state || state.isCrypto) return;

  for (const stock of cards) {
    if (stock.mktCap !== null || state.mktCapRequested.has(stock.ticker)) continue;
    state.mktCapRequested.add(stock.ticker);
    getMarketCap(stock.ticker).then(value => {
      stock.mktCap = value;
      renderSection(gridId);
    });
  }
}

function renderSection(gridId) {
  const state = sectionState[gridId];
  const grid = document.getElementById(gridId);
  if (!state) return;

  if (state.results.length === 0) {
    if (state.pending > 0) return; // still just skeletons — nothing resolved yet
    grid.innerHTML = `<div class="loading-state">😤 Data unavailable right now. Try refreshing.</div>`;
    return;
  }

  let cards, note = '';
  if (state.sortMode === 'high') {
    cards = [...state.results].sort((a, b) => a.pctOffHigh - b.pctOffHigh).slice(0, 9);
  } else {
    const oversold = state.results
      .filter(s => s.rsi !== null && s.rsi < 35)
      .sort((a, b) => a.rsi - b.rsi)
      .slice(0, 9);

    if (oversold.length > 0) {
      cards = oversold;
    } else if (state.pending === 0) {
      cards = [...state.results].filter(s => s.rsi !== null).sort((a, b) => a.rsi - b.rsi).slice(0, 6);
      note = state.isCrypto
        ? "Nothing's truly oversold in crypto today — showing the least-loved coins from our watchlist."
        : "Nothing's truly oversold today — showing the least-loved stocks from our watchlist.";
    } else {
      cards = []; // wait for more of the watchlist before falling back
    }
  }

  const skeletonCount = Math.min(state.pending, Math.max(0, 9 - cards.length));
  grid.innerHTML = (note ? `<div class="section-note">💡 ${note}</div>` : '')
    + cards.map((s, i) => renderCard(s, i, state.isCrypto)).join('')
    + skeletonHTML(skeletonCount);

  hydrateMarketCaps(gridId, cards);
}

// Tickers resolve one at a time behind the shared request queue, so we
// render progressively — each card appears/re-sorts in as its data lands
// instead of the whole section staying blank until the last (rate-limited)
// fetch finishes.
async function loadSection(watchlist, gridId, isCrypto) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = skeletonHTML(Math.min(6, watchlist.length));
  sectionState[gridId] = {
    results: [], isCrypto, sortMode: 'rsi',
    pending: watchlist.length, mktCapRequested: new Set(),
  };

  await Promise.all(watchlist.map(async item => {
    const stock = await fetchTicker({ ...item, isCrypto });
    const state = sectionState[gridId];
    state.pending--;
    if (stock) state.results.push(stock);
    renderSection(gridId);
    updateStinkIndex();
  }));
}

document.querySelectorAll('.sort-toggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    const { grid: gridId, mode } = btn.dataset;
    if (!sectionState[gridId]) return;
    sectionState[gridId].sortMode = mode;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    renderSection(gridId);
  });
});

// Cards are re-rendered via innerHTML on every sort/hydration pass, so share
// buttons come and go — one delegated listener on the container outlives that.
document.querySelector('.container').addEventListener('click', e => {
  const btn = e.target.closest('.share-btn');
  if (!btn) return;
  const { ticker, name, offHigh, rsi } = btn.dataset;
  const text = `${ticker} (${name}) is down ${Math.abs(offHigh)}% from its 52-week high and sitting at RSI ${rsi} on FartDollar.com 💨`;
  const shareUrl = 'https://twitter.com/intent/tweet'
    + `?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://fartdollar.com')}`;
  window.open(shareUrl, '_blank', 'noopener');
});

// ---- MARKET STINK INDEX ----
// Average % off 52-week high across every ticker that's resolved so far
// (the whole watchlist, not just the top cards on display) — updates live
// as each section's fetches land, then locks in once both are done.
function updateStinkIndex() {
  const sections = ['stocks-grid', 'crypto-grid'].map(id => sectionState[id]).filter(Boolean);
  const allResults = sections.flatMap(s => s.results);
  if (allResults.length === 0) return;

  const avgOffHigh = allResults.reduce((sum, s) => sum + Math.abs(s.pctOffHigh), 0) / allResults.length;
  const tiers = [
    [10, 'Barely Sniffable'], [25, 'Mildly Funky'], [40, 'Pretty Rotten'],
    [60, 'Nose-Burning'], [Infinity, 'Biohazard'],
  ];
  const [, tierLabel] = tiers.find(([max]) => avgOffHigh < max);

  const stillLoading = sections.some(s => s.pending > 0);
  document.getElementById('stink-index-value').textContent =
    `${avgOffHigh.toFixed(0)}% off highs — ${tierLabel}${stillLoading ? '…' : ''}`;
}

// ---- INVEST TICKER ----
let fartPrice = 0.000;

function invest() {
  fartPrice = Math.round((fartPrice + 0.001) * 1000) / 1000;
  const priceEl  = document.getElementById('fart-price');
  const changeEl = document.getElementById('fart-change');
  priceEl.textContent = '$' + fartPrice.toFixed(3);
  changeEl.classList.remove('flash');
  void changeEl.offsetWidth; // reflow to restart animation
  changeEl.classList.add('flash');
  setTimeout(() => changeEl.classList.remove('flash'), 800);
  playFart();
}

// ---- COUNTDOWN (resets every Monday) ----
function updateCountdown() {
  const now = new Date();
  const nextMonday = new Date(now);
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  const diff = nextMonday - now;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  document.getElementById("cd-d").textContent = String(d).padStart(2,"0");
  document.getElementById("cd-h").textContent = String(h).padStart(2,"0");
  document.getElementById("cd-m").textContent = String(m).padStart(2,"0");
  document.getElementById("cd-s").textContent = String(s).padStart(2,"0");
}
updateCountdown();
setInterval(updateCountdown, 1000);

// Load both sections simultaneously
Promise.all([
  loadSection(STOCK_WATCHLIST, 'stocks-grid', false),
  loadSection(CRYPTO_WATCHLIST, 'crypto-grid', true)
]);
