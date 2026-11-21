// Token Radar's page. It reads window.RADAR (written beside dashboard/ by main.ts) and renders the
// ranked board, filters, search, sort, a detail drawer for every protocol with its farm plan, the
// stated model with its derived weights, and a Live view of the protocols whose token already trades.
// No network: every byte it shows is in data.js, and it recomputes a row's implied value from the
// snapshot's own figures to show the page and the board are the same arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('app');
  if (!DATA || !app) return;

  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, seg: 'all', sort: 'rank', dir: 1, selected: null };

  // A shareable filter link: ?seg=watchlist&category=RWA&chain=Base&minTvl=100000000&q=plume&sort=implied&dir=-1
  // and #row-<slug> for a detail view. The params only set the page's own state; no network is involved.
  (function readParams() {
    var q = new URLSearchParams(location.search);
    if (q.has('q')) state.q = q.get('q');
    if (q.has('category')) state.category = q.get('category');
    if (q.has('chain')) state.chain = q.get('chain');
    if (q.has('seg')) state.seg = q.get('seg');
    if (q.has('minTvl')) state.minTvl = Number(q.get('minTvl')) || 0;
    if (q.has('sort')) state.sort = q.get('sort');
    if (q.has('dir')) state.dir = Number(q.get('dir')) || 1;
    if (q.has('detail')) state.selected = q.get('detail');
  })();

  // ---------------------------------------------------------------- formatting
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'not recorded';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'not recorded';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'not recorded';
    return days >= 365 ? (days / 365).toFixed(1) + 'y' : Math.round(days) + 'd';
  }
  function fmtInt(n) { return (n === null || n === undefined) ? 'not recorded' : new Intl.NumberFormat('en-US').format(n); }
  function pctClass(n) { return n === null || n === undefined ? 'muted' : n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted'; }

  // The model in the page, the same function the program runs: TVL x base x growth x maturity x
  // category weight x chain weight. A row recomputes to the number board.json carries.
  function impliedOf(row) {
    var m = DATA.model;
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    g = Math.min(m.growth_cap, Math.max(m.growth_floor, g));
    var growthMult = 1 + (g / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * m.base_multiple * growthMult * maturity * row.category_weight * row.chain_weight));
  }

  // ---------------------------------------------------------------- small DOM helper
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) add(node, arguments[i]);
    return node;
  }
  function add(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { add(node, c); }); return; }
    node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }

  // ---------------------------------------------------------------- filtering
  function rowsFor(seg) {
    return DATA.rows.filter(function (r) {
      if (seg === 'watchlist' && !r.on_watchlist) return false;
      if (seg === 'early' && r.on_watchlist) return false;
      if (seg === 'tvl1b' && r.tvl_usd < 1e9) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (state.q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }
  function sortRows(rows) {
    var key = state.sort, dir = state.dir;
    var cmp = {
      rank: function (a, b) { return a.rank - b.rank; },
      name: function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0; },
      category: function (a, b) { return (a.category || '') < (b.category || '') ? -1 : (a.category || '') > (b.category || '') ? 1 : a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      change: function (a, b) { return (b.change_7d || -1e9) - (a.change_7d || -1e9); },
      age: function (a, b) { return (b.age_days || -1) - (a.age_days || -1); },
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; }
    }[key] || cmpRank;
    function cmpRank(a, b) { return a.rank - b.rank; }
    return rows.slice().sort(function (a, b) { return dir * cmp(a, b) || a.rank - b.rank; });
  }
  function uniqueCategories() { return uniq(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; })); }
  function uniqueChains() { return uniq(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains); }, [])); }
  function uniq(list) { var seen = {}, out = []; list.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out.sort(); }

  // ---------------------------------------------------------------- header + hero
  function header() {
    var biggest = DATA.rows[0];
    var max = biggest ? biggest.implied_value_usd : 1;
    var head = el('div', { class: 'panel-head' },
      el('div', null, el('h2', { text: 'Ranked board' }), el('span', { class: 'sub', text: 'Every protocol whose record carries no token, strongest implied value first.' })),
      el('span', { class: 'sub', text: 'top value ' + fmtUsd(max) })
    );
    return head;
  }
  function hero() {
    var w = DATA.weights;
    var total = DATA.protocol_count || (DATA.pre_token_size + DATA.live_size);
    return el('section', { class: 'hero', id: 'top' },
      el('div', null,
        el('div', { class: 'eyebrow', text: 'token launch radar' }),
        el('h1', { text: 'Which protocols record no token, and what a launch would be worth.' }),
        el('p', { class: 'lede', html:
          'This radar reads one frozen DefiLlama snapshot of <b>' + fmtInt(total) + '</b> protocols and scores every one that records no token of its own and stands on its own. ' +
          'A protocol is <b>pre-token</b> when its record holds no market cap, no CoinGecko id and no symbol; the radar never says a protocol has no token, only that its record carries none. ' +
          'Each row is ranked by an <b>implied value</b> derived from the snapshot alone: its TVL, its seven-day growth, how long it has run with no token, and the multiple its category and chain trade at among protocols that already have one.'
        }),
        el('p', { class: 'lede', text: 'The board starts with the snapshot\u2019s ' + DATA.watchlist_size + '-protocol watchlist, the house\u2019s floor, and adds every other protocol that records no token and is not a wrapped, staked, bridged or versioned product of one that trades: ' + DATA.board_size + ' rows, none hand-picked. The products themselves, and the protocols whose token already trades, are listed below the board.' })
      ),
      el('aside', { class: 'facts', 'aria-label': 'Snapshot facts' },
        fact('Snapshot', DATA.as_of, ''),
        fact('Watchlist covered', DATA.watchlist_rows + ' / ' + DATA.watchlist_size, 'ok'),
        fact('Board rows', fmtInt(DATA.board_size), ''),
        fact('Pre-token candidates', fmtInt(DATA.pre_token_size), ''),
        fact('Products set aside', fmtInt(DATA.product_size), ''),
        fact('Live-token protocols', fmtInt(DATA.live_size) + ' shown', ''),
        fact('Global mcap / TVL', w.global_ratio.toFixed(3) + '\u00d7', ''),
        fact('Model', DATA.model_version, '')
      )
    );
  }
  function fact(label, value, cls) {
    return el('div', { class: 'fact ' + (cls || '') }, el('span', { class: 'k', text: label }), el('b', { text: value }));
  }

  // ---------------------------------------------------------------- controls
  function controls() {
    var cats = uniqueCategories(), chains = uniqueChains();
    function sel(label, value, options, onchange) {
      var s = el('select', { onchange: onchange });
      options.forEach(function (o) { s.appendChild(el('option', { value: o.value, selected: o.value === value ? 'selected' : null, text: o.text })); });
      return el('label', { class: 'field' }, el('span', null, label), s);
    }
    var q = el('input', { type: 'search', placeholder: 'Search name, slug, category or chain', value: state.q, oninput: function (e) { state.q = e.target.value; paint(); } });
    var segs = el('div', { class: 'seg', role: 'group', 'aria-label': 'Segments' });
    [['all', 'All candidates'], ['watchlist', 'Watchlist'], ['early', 'Early (below floor)'], ['tvl1b', 'TVL \u2265 $1B']].forEach(function (pair) {
      segs.appendChild(el('button', { type: 'button', 'aria-pressed': state.seg === pair[0] ? 'true' : 'false', text: pair[1], onclick: function () { state.seg = pair[0]; paint(); } }));
    });
    var reset = el('button', { class: 'reset', type: 'button', text: 'Reset', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.seg = 'all'; state.sort = 'rank'; state.dir = 1; paint(); } });
    var n = rowsFor(state.seg).length;
    return el('section', { class: 'controls', id: 'controls', 'aria-label': 'Filters' },
      el('div', { class: 'shell controls-row' },
        el('label', { class: 'field' }, el('span', null, 'Search'), q),
        sel('Category', state.category, [{ value: 'all', text: 'All categories' }].concat(cats.map(function (c) { return { value: c, text: c }; })), function (e) { state.category = e.target.value; paint(); }),
        sel('Chain', state.chain, [{ value: 'all', text: 'All chains' }].concat(chains.map(function (c) { return { value: c, text: c }; })), function (e) { state.chain = e.target.value; paint(); }),
        sel('Minimum TVL', String(state.minTvl), [{ value: '0', text: 'Any TVL' }, { value: '100000000', text: '\u2265 $100M' }, { value: '500000000', text: '\u2265 $500M' }, { value: '1000000000', text: '\u2265 $1B' }], function (e) { state.minTvl = Number(e.target.value); paint(); }),
        segs,
        reset,
        el('span', { class: 'count spacer', text: fmtInt(n) + ' of ' + fmtInt(DATA.board_size) + ' rows' })
      )
    );
  }

  // ---------------------------------------------------------------- board table
  function sortable(key, label) {
    var active = state.sort === key;
    var th = el('th', { class: 'sortable', scope: 'col' });
    th.setAttribute('aria-sort', active ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
    th.appendChild(el('button', { type: 'button', text: label + (active ? (state.dir === 1 ? ' \u2191' : ' \u2193') : ''),
      onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = (key === 'rank' || key === 'name' || key === 'category') ? 1 : -1; } paint(); } }));
    return th;
  }
  function boardTable() {
    var rows = sortRows(rowsFor(state.seg));
    var max = DATA.rows[0] ? DATA.rows[0].implied_value_usd : 1;
    var thead = el('thead', null, el('tr', null,
      sortable('rank', '#'), sortable('name', 'Protocol'), sortable('category', 'Category'), sortable('tvl', 'TVL'),
      sortable('change', '7d'), sortable('age', 'No token for'), sortable('implied', 'Implied value'),
      el('th', { scope: 'col', text: 'Why it ranks here' })
    ));
    var tbody = el('tbody', null);
    rows.forEach(function (r) {
      var tr = el('tr', { 'data-slug': r.slug, 'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r.slug, false); },
        onkeydown: function (e) { if (e.key === 'Enter') openDetail(r.slug, false); } });
      var badge = r.segment === 'watchlist' ? el('span', { class: 'badge watch', text: 'Watchlist' }) : el('span', { class: 'badge early', text: 'Early' });
      tr.appendChild(el('td', { class: 'rank', text: String(r.rank) }));
      tr.appendChild(el('td', null, el('span', { class: 'proto' }, el('b', null, r.name, ' ', badge), el('span', { class: 'sub', text: (r.chains.length ? r.chains.slice(0, 3).join(', ') : 'chain not recorded') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') }))));
      tr.appendChild(el('td', { text: r.category || 'Uncategorised' }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { class: 'num ' + pctClass(r.change_7d), text: fmtPct(r.change_7d) }));
      tr.appendChild(el('td', { class: 'num', text: fmtAge(r.age_days) }));
      var width = Math.max(2, Math.round((r.implied_value_usd / max) * 100));
      tr.appendChild(el('td', null, el('span', { class: 'implied' }, el('b', { text: fmtUsd(r.implied_value_usd) }), el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + width + '%' })))));
      tr.appendChild(el('td', null, el('span', { class: 'reason', text: r.reason })));
      tbody.appendChild(tr);
    });
    if (rows.length === 0) {
      tbody.appendChild(el('tr', null, el('td', { colspan: '8' }, el('div', { class: 'empty' }, el('p', { text: 'No protocol matches these filters.' }), el('button', { class: 'reset', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.seg = 'all'; paint(); } })))));
    }
    return el('section', { class: 'panel', id: 'board' }, header(), el('div', { class: 'table-wrap' }, el('table', null, thead, tbody)));
  }

  // ---------------------------------------------------------------- live view
  function liveTable() {
    var tbody = el('tbody', null);
    var live = (DATA.live || []).map(function (l) { return { row: l, kind: 'live' }; });
    var products = (DATA.products || []).map(function (l) { return { row: l, kind: 'product' }; });
    live.concat(products).forEach(function (item) {
      var l = item.row;
      var status = item.kind === 'live'
        ? el('span', { class: 'badge live', text: 'Token trades' })
        : el('span', { class: 'badge early', text: 'Product of a trading token' });
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'proto' }, el('b', null, l.name), el('span', { class: 'sub', text: item.kind === 'product' ? (l.product_reason || 'a product of another protocol\u2019s token') : (l.chains.length ? l.chains.slice(0, 3).join(', ') : 'chain not recorded') }))),
        el('td', { text: l.category || 'Uncategorised' }),
        el('td', { class: 'num', text: fmtUsd(l.tvl_usd) }),
        el('td', { class: 'num', text: l.mcap_usd === null ? 'not recorded' : fmtUsd(l.mcap_usd) }),
        el('td', { class: 'num ' + pctClass(l.change_7d), text: fmtPct(l.change_7d) }),
        el('td', null, status)
      ));
    });
    var liveN = (DATA.live || []).length, prodN = (DATA.products || []).length;
    return el('section', { class: 'panel', id: 'live' },
      el('div', { class: 'panel-head' }, el('div', null, el('h2', { text: 'Live tokens and set-aside products' }), el('span', { class: 'sub', text: 'Protocols whose token already trades (top), and protocols that record no token yet are a wrapped, staked, bridged or versioned product of one that trades. Neither is a launch target of its own, so neither is ranked on the board.' })), el('span', { class: 'sub', text: fmtInt(liveN) + ' live \u00b7 ' + fmtInt(prodN) + ' products' })),
      el('div', { class: 'table-wrap' }, el('table', null, el('thead', null, el('tr', null,
        el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'TVL' }),
        el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Status' })
      )), tbody))
    );
  }

  // ---------------------------------------------------------------- model section
  function modelSection() {
    var m = DATA.model, w = DATA.weights;
    var formula = [
      'global  = median( mcap_usd / tvl_usd ) over the live-token protocols = ' + w.global_ratio.toFixed(3) + 'x  (' + fmtInt(w.live_samples) + ' samples)',
      '',
      'weight(category) = clamp( shrink(median in the category, to global, n=' + m.shrink_samples + ') / global , ' + m.category_weight_floor + ', ' + m.category_weight_cap + ' )',
      'weight(chain)    = clamp( shrink(median on the chain,      to global, n=' + m.shrink_samples + ') / global , ' + m.chain_weight_floor + ', ' + m.chain_weight_cap + ' )',
      '',
      'base     = tvl_usd \u00d7 ' + m.base_multiple,
      'growth   = clamp( change_7d , ' + m.growth_floor + ' , ' + m.growth_cap + ' ) %    growthMult = 1 + growth/100 \u00d7 ' + m.growth_weight,
      'age      = listed_at ? whole days since : ' + m.unknown_age_days + '    maturity = ' + m.maturity_floor + ' + min(age,' + m.maturity_days + ')/' + m.maturity_days + ' \u00d7 ' + m.maturity_range,
      '',
      'implied  = max(1, round( base \u00d7 growthMult \u00d7 maturity \u00d7 weight(category) \u00d7 weight(chain) ))'
    ].join('\n');
    return el('section', { class: 'section', id: 'model' },
      el('h2', { text: 'The value model' }),
      el('div', { class: 'grid', style: 'margin-top:16px' },
        el('div', { class: 'card' },
          el('h3', { text: 'One function scores every row' }),
          el('p', { text: 'Implied value is what the protocol\u2019s token would be worth if the snapshot\u2019s figures held. It follows from the snapshot alone; no protocol name is special-cased and no row is hand-picked.' }),
          el('div', { class: 'formula', text: formula }),
          el('p', { class: 'note', style: 'margin-top:12px', text: 'A category or chain with too few live samples is shrunk toward the global ratio, so one row never sets a weight. The growth and maturity terms are the house model; the category and chain weights are read from the snapshot\u2019s own live-token rows.' })
        ),
        weightCard('Category multiples', w.category),
        weightCard('Chain multiples', w.chain.slice(0, 10))
      )
    );
  }
  function weightCard(title, list) {
    var max = list.reduce(function (a, c) { return Math.max(a, c.weight); }, 1);
    var wrap = el('div', { class: 'card' }, el('h3', { text: title }), el('p', { text: 'The multiple each group trades at among live protocols, clamped to a sane band. A higher multiple lifts a pre-token protocol\u2019s implied value.' }));
    var body = el('div', { class: 'weight-list' });
    list.forEach(function (c) {
      body.appendChild(el('div', { class: 'weight-row' },
        el('span', { class: 'nm', text: c.name }),
        el('span', { class: 'n', text: c.weight.toFixed(2) + '\u00d7' }),
        el('span', { class: 'n', text: c.samples + ' live' }),
        el('span', { class: 'track' }, el('i', { style: 'width:' + Math.round((c.weight / max) * 100) + '%' }))
      ));
    });
    wrap.appendChild(body);
    return wrap;
  }

  // ---------------------------------------------------------------- detail drawer
  var dialog;
  function detail() {
    dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
    dialog.addEventListener('close', function () { state.selected = null; syncSelected(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    return dialog;
  }
  function openDetail(slug, scroll) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    dialog.textContent = '';
    var recomputed = impliedOf(row);
    var head = el('div', { class: 'detail-head' },
      el('div', null,
        el('div', { class: 'eyebrow', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? ' \u00b7 on the watchlist' : ' \u00b7 early, below the floor') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Uncategorised') + ' \u00b7 ' + (row.chains.length ? row.chains.join(', ') : 'chain not recorded') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    );
    var inner = el('div', { class: 'detail-inner' });

    inner.appendChild(el('section', { class: 'detail-section', style: 'margin-top:0' },
      el('div', { class: 'ai-note', text: 'Records no token in the snapshot: no market cap, no CoinGecko id and no symbol. That is a fact about its record, not a claim it has no token.' })
    ));
    inner.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        eq('TVL', fmtUsd(row.tvl_usd)),
        eq('Seven-day growth', fmtPct(row.change_7d) + '  \u00d7 ' + row.growth_multiplier.toFixed(3)),
        eq('Age with no token', fmtAge(row.age_days) + '  \u00d7 ' + row.maturity_multiplier.toFixed(3)),
        eq('Category multiple', (row.category || 'Uncategorised') + '  \u00d7 ' + row.category_weight.toFixed(3)),
        eq('Chain multiple', row.chain + '  \u00d7 ' + row.chain_weight.toFixed(3)),
        eq('Implied value', fmtUsd(row.implied_value_usd))
      ),
      el('p', { class: 'note', style: 'margin-top:10px', text: 'Model ' + DATA.model_version + ' recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the number board.json carries.' : ', which differs from the board: the data is stale.') + ' This is an estimate, not a price and not a forecast.' })
    ));
    inner.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('p', { class: 'note', style: 'margin-bottom:12px', text: 'Derived from this protocol\u2019s category, chain, TVL and age, so a lending plan differs from a DEX, RWA or curator plan. Cost and time are estimates.' }),
      el('ol', { class: 'steps' }, (row.farm_steps || []).map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('div', null, el('div', { class: 'action', text: action }), el('div', { class: 'cost', text: tail })));
      }))
    ));
    inner.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Record' }),
      el('div', { class: 'equation' },
        eq('Slug', row.slug),
        eq('First listed', row.listed_at || 'not recorded'),
        eq('Symbol recorded', 'none'),
        eq('Chains', row.chains.length ? row.chains.join(', ') : 'not recorded')
      )
    ));
    dialog.appendChild(head);
    dialog.appendChild(inner);
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
    syncSelected();
  }
  function eq(label, value) { return el('div', null, el('span', { text: label }), el('b', { text: String(value) })); }
  function syncSelected() {
    var body = document.querySelector('tbody');
    if (!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('tr[data-slug]'), function (tr) {
      tr.setAttribute('data-selected', tr.getAttribute('data-slug') === state.selected ? 'true' : 'false');
    });
  }

  // ---------------------------------------------------------------- paint
  function paint() {
    app.textContent = '';
    app.appendChild(hero());
    app.appendChild(controls());
    app.appendChild(boardTable());
    app.appendChild(modelSection());
    app.appendChild(liveTable());
    app.setAttribute('aria-busy', 'false');
    if (!dialog || !dialog.isConnected) { detail(); app.appendChild(dialog); }
    var hash = location.hash.slice(1);
    if (hash && hash.indexOf('row-') === 0) openDetail(hash.slice(4), true);
    else if (state.selected) openDetail(state.selected, false);
    syncSelected();
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog && dialog.open) dialog.close(); });
  paint();

  // A deep link like #row-curvance opens that protocol's detail on load, so a screenshot or a
  // bookmark can point at one row. No network is involved: the hash names a slug in data.js.
  window.addEventListener('hashchange', function () {
    var hash = location.hash.slice(1);
    if (hash.indexOf('row-') === 0) openDetail(hash.slice(4), true);
  });
})();
