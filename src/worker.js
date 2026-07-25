// Proxy Worker for fartdollar.com. Serves the static site via env.ASSETS and
// relays two read-only data routes so the browser never sees POLYGON_API_KEY.
//
// The client always sends the literal query param `apiKey=proxy` (see
// PROXY usage in app.js) — that placeholder is swapped for the real secret
// here, server-side, right before the outbound fetch.

const ALLOWED_ORIGIN = 'https://fartdollar.com';
const POLYGON_BASE = 'https://api.polygon.io';
const APEWISDOM_URL = 'https://apewisdom.io/api/v1.0/filter/all-stocks/page/1';

// Prebuilt WebAssembly PrBoom+ (GPL) with the 1993 DOOM shareware IWAD baked
// in, from https://github.com/raz0red/webprboom's github-pages branch. The
// .data file alone is ~39MB, over Cloudflare's 25MB static-asset-per-file
// cap, so all three engine files are proxied here at request time rather
// than deployed as assets — same-origin for the page that loads them, which
// avoids the frame/cross-origin-isolation restrictions that blocked
// embedding third-party Doom demos directly.
const DOOM_BASE = 'https://raw.githubusercontent.com/raz0red/webprboom/github-pages/doom1';
const DOOM_ASSETS = {
  'doom1.js': 'application/javascript',
  'doom1.wasm': 'application/wasm',
  'doom1.data': 'application/octet-stream',
};

// Ticker/symbol as used by app.js: plain tickers (AAPL) or crypto pairs
// (X:BTCUSD). Dates are always ISO (YYYY-MM-DD) from toISODate().
const TICKER_RE = /^[A-Z0-9:.\-]{1,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AGGS_PATH_RE = /^\/v2\/aggs\/ticker\/([^/]+)\/range\/1\/day\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/;
const TICKER_DETAIL_PATH_RE = /^\/v3\/reference\/tickers\/([^/]+)$/;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

async function proxyToPolygon(polygonPath, search, env) {
  const upstream = new URL(POLYGON_BASE + polygonPath);
  upstream.search = search;
  upstream.searchParams.set('apiKey', env.POLYGON_API_KEY);

  const res = await fetch(upstream);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

async function handleTickerDetail(url, env) {
  const match = TICKER_DETAIL_PATH_RE.exec(url.pathname);
  const ticker = match[1];
  if (!TICKER_RE.test(ticker)) return jsonResponse({ status: 'ERROR', error: 'invalid ticker' }, 400);

  return proxyToPolygon(`/v3/reference/tickers/${ticker}`, url.search, env);
}

async function handleAggs(url, env) {
  const match = AGGS_PATH_RE.exec(url.pathname);
  const [, symbol, from, to] = match;
  if (!TICKER_RE.test(symbol) || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return jsonResponse({ status: 'ERROR', error: 'invalid params' }, 400);
  }

  return proxyToPolygon(`/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}`, url.search, env);
}

async function handleDoomAsset(filename) {
  const contentType = DOOM_ASSETS[filename];
  const res = await fetch(`${DOOM_BASE}/${filename}`, {
    cf: { cacheTtl: 31536000, cacheEverything: true },
  });
  if (!res.ok) return new Response('Not found', { status: 502 });
  // Short browser cache, not "immutable" — a bad or truncated response
  // here shouldn't be able to strand a visitor's browser on a broken copy
  // for a year with no way to self-heal on a normal reload. Cloudflare's
  // own edge cache (the cf option above) still absorbs repeat traffic.
  return new Response(res.body, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' },
  });
}

async function handleWsbMentions() {
  const res = await fetch(APEWISDOM_URL);
  if (!res.ok) return jsonResponse({ results: [] }, 502);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method === 'GET') {
      if (url.pathname === '/wsb-mentions') return handleWsbMentions();
      if (TICKER_DETAIL_PATH_RE.test(url.pathname)) return handleTickerDetail(url, env);
      if (AGGS_PATH_RE.test(url.pathname)) return handleAggs(url, env);
      if (url.pathname.startsWith('/doom-assets/')) {
        const filename = url.pathname.slice('/doom-assets/'.length);
        if (Object.prototype.hasOwnProperty.call(DOOM_ASSETS, filename)) return handleDoomAsset(filename);
        return new Response('Not found', { status: 404 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
