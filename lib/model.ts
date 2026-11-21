// The token radar's model: one frozen snapshot of the protocol universe in, one ranked board out,
// plus the plan a reader follows to farm each protocol before or after it issues a token.
//
// Coverage. The board carries every protocol in the snapshot's watchlist (the house's floor, never a
// ceiling) AND every other protocol that records no token and stands on its own: the whole set of real
// launch candidates the snapshot holds, not the watchlist alone. A protocol is "pre-token" when its
// record carries no token (no market cap, no CoinGecko id, no symbol): the radar says a protocol records
// no token, never that it has none. Two groups are kept off the board and shown in the Live view
// instead: the protocols whose token already trades, and the wrapped, staked, bridged or versioned
// products of such a protocol, none of which are a launch target of their own.
//
// Implied value. Every row is scored by one function of the snapshot's own figures. No protocol name is
// ever special-cased; the same function scores every row. The formula, and the constants the dashboard
// and the README quote, are:
//
//   globalRatio   = median over the snapshot's live-token protocols of mcap_usd / tvl_usd
//   categoryRatio = shrink( median mcap/tvl of the live protocols in the row's category, to globalRatio )
//   chainRatio    = shrink( median mcap/tvl of the live protocols on the row's first chain, to globalRatio )
//   categoryWeight= clamp( categoryRatio / globalRatio, 0.55, 1.75 )
//   chainWeight   = clamp( chainRatio    / globalRatio, 0.75, 1.30 )
//   base          = tvl_usd x BASE_MULTIPLE
//   growth        = clamp(change_7d, GROWTH_FLOOR, GROWTH_CAP) per cent
//   growthMult    = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity      = MATURITY_FLOOR + min(age_days, MATURITY_DAYS) / MATURITY_DAYS x MATURITY_RANGE
//   implied       = max(1, round(base x growthMult x maturity x categoryWeight x chainWeight))
//
// where age_days is the whole days since the protocol was first listed (listed_at), or
// UNKNOWN_AGE_DAYS when the snapshot reports none, and a category or chain with too few live samples
// to price is shrunk back toward the global ratio (sample size K), so a single row never moves a weight.
//
// The growth and maturity terms are the house's model; the category and chain weights are read from the
// snapshot's own live-token rows, so the model is data-derived end to end. Cost and hold figures in the
// farm plans follow the protocol's own TVL and age; nothing is hand-picked per name.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and any reader may audit them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  category_weight_floor: number;
  category_weight_cap: number;
  chain_weight_floor: number;
  chain_weight_cap: number;
  shrink_samples: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.2,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  category_weight_floor: 0.55,
  category_weight_cap: 1.75,
  chain_weight_floor: 0.75,
  chain_weight_cap: 1.3,
  shrink_samples: 12,
};

/** The model's version label: the dashboard names it and the board carries it. */
export const MODEL_VERSION = 'radar-2.1';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The model's own inputs and outputs for one row, carried so a reader can audit the number. */
export interface RowModel {
  base_multiple: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_weight: number;
  chain_weight: number;
  category_ratio: number;
  chain_ratio: number;
  global_ratio: number;
  age_days: number | null;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  chain: string;
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  segment: 'watchlist' | 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  reason: string;
  model: RowModel;
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page renders the farm plan it also ships. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  chain: string;
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  on_watchlist: boolean;
  segment: 'watchlist' | 'pre-token';
  reason: string;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_weight: number;
  chain_weight: number;
  farm_steps: string[];
}

/**
 * A protocol in the Live view. A `live` row's token already trades, so the view shows the market's own
 * value; a `product` row is a wrapped, staked, bridged or versioned product of a token that trades, so
 * it names why it is not a launch target of its own. Neither is ranked on the board.
 */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  kind: 'live' | 'product';
  product_reason: string | null;
}

/** The category and chain weights read from the snapshot's live rows. */
export interface ModelWeights {
  global_ratio: number;
  live_samples: number;
  category: { name: string; ratio: number; weight: number; samples: number }[];
  chain: { name: string; ratio: number; weight: number; samples: number }[];
}

/** Everything the dashboard needs: the board, the live set, the weights and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  protocol_count: number;
  watchlist_size: number;
  board_size: number;
  watchlist_rows: number;
  early_size: number;
  pre_token_size: number;
  live_size: number;
  product_size: number;
  weights: ModelWeights;
  rows: RadarRow[];
  live: LiveRow[];
  products: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list, or `fallback` when it is empty. */
export function median(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 1e2) / 1e2;

/** A protocol whose record carries no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The ratio mcap/tvl a live protocol trades at, or null when it reports no usable pair. */
function liveRatio(p: SnapshotProtocol): number | null {
  if (isPreToken(p)) return null;
  const mcap = p.mcap_usd;
  if (mcap === null || !Number.isFinite(mcap) || mcap <= 0) return null;
  if (!Number.isFinite(p.tvl_usd) || p.tvl_usd <= 0) return null;
  return mcap / p.tvl_usd;
}

/** Shrink a group's median ratio toward the global ratio by `k` pseudo-observations. */
function shrink(samples: number[], global: number, k: number): number {
  if (samples.length === 0) return global;
  const m = median(samples, global);
  return (samples.length * m + k * global) / (samples.length + k);
}

/** The category and chain weights the snapshot's own live-token rows imply, clamp and all. */
export function deriveWeights(snapshot: Snapshot, model: ModelConstants = MODEL): ModelWeights {
  const byCategory = new Map<string, number[]>();
  const byChain = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    const r = liveRatio(p);
    if (r === null) continue;
    all.push(r);
    const cat = p.category ?? 'Uncategorised';
    (byCategory.get(cat) ?? byCategory.set(cat, []).get(cat)!).push(r);
    for (const chain of p.chains) (byChain.get(chain) ?? byChain.set(chain, []).get(chain)!).push(r);
  }
  const global = median(all, 1);
  const k = model.shrink_samples;
  const catList = [...byCategory.entries()]
    .map(([name, xs]) => {
      const ratio = shrink(xs, global, k);
      const weight = clamp(ratio / global, model.category_weight_floor, model.category_weight_cap);
      return { name, ratio: round4(ratio), weight: round4(weight), samples: xs.length };
    })
    .sort((a, b) => b.weight - a.weight || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const chainList = [...byChain.entries()]
    .map(([name, xs]) => {
      const ratio = shrink(xs, global, k);
      const weight = clamp(ratio / global, model.chain_weight_floor, model.chain_weight_cap);
      return { name, ratio: round4(ratio), weight: round4(weight), samples: xs.length };
    })
    .sort((a, b) => b.weight - a.weight || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { global_ratio: round4(global), live_samples: all.length, category: catList, chain: chainList };
}

/** The first chain a protocol names, as the model and the plan read it. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

// A name ending in a version marker is a pool of another protocol, and a name carrying a wrapped,
// staked or staking word, or a category that names a bridge, a staking product or an exchange, is a
// product of a token that already trades. This is the house's own exclusion rule, applied to every
// row by one function; no protocol name is special-cased.
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const PRODUCT_WORD = /\b(wrapped|staked|staking|restaked)\b/i;
const PRODUCT_CATEGORY = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const EXCHANGE_PREFIX = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol is a wrap, stake, bridge or versioned product of a token that already trades. */
export function productOfTradingToken(p: SnapshotProtocol): string | null {
  if (p.category !== null && PRODUCT_CATEGORY.has(p.category)) return `${p.category} is a product of another protocol's token`;
  if (VERSIONED.test(p.name)) return 'the name ends in a version marker, so it is another pool';
  if (PRODUCT_WORD.test(p.name)) return 'the name carries a wrapped, staked or staking word';
  for (const prefix of EXCHANGE_PREFIX) if (p.name.startsWith(prefix)) return `the name begins with the exchange ${prefix}`;
  return null;
}

/** The three multipliers and the implied value one protocol gets under `model` and `weights`. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  weights: ModelWeights,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; categoryWeight: number; chainWeight: number; categoryRatio: number; chainRatio: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const rawGrowth = finite(p.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (clamp(ageForModel, 0, model.maturity_days) / model.maturity_days) * model.maturity_range;
  const cat = weights.category.find((c) => c.name === (p.category ?? 'Uncategorised'));
  const chain = weights.chain.find((c) => c.name === chainOf(p));
  const categoryWeight = cat?.weight ?? 1;
  const chainWeight = chain?.weight ?? 1;
  const base = p.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * categoryWeight * chainWeight));
  return {
    implied,
    growthPct,
    growthMult,
    maturityMult,
    categoryWeight,
    chainWeight,
    categoryRatio: cat?.ratio ?? weights.global_ratio,
    chainRatio: chain?.ratio ?? weights.global_ratio,
    age,
  };
}

/** The board's headline figures. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n: every pre-token protocol. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, weights: ModelWeights = deriveWeights(snapshot, model)): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  // The board ranks genuine launch candidates: protocols that record no token AND stand on their own.
  // A wrapped, staked, bridged or versioned product of a token that already trades is not a launch of
  // its own, so it is set aside for the Live view's product list, never ranked here.
  const isCandidate = (p: SnapshotProtocol): boolean => isPreToken(p) && productOfTradingToken(p) === null;
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Full coverage: every other genuine pre-token protocol joins the board.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isCandidate(p)) chosen.set(p.slug, p);
  }
  const watchlist = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => {
    const m = impliedValue(p, snapshot.as_of, model, weights);
    return { p, m };
  });
  scored.sort((a, b) => b.m.implied - a.m.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const p = s.p;
    const onWatchlist = watchlist.has(p.slug);
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      chain: chainOf(p),
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token' as const,
      on_watchlist: onWatchlist,
      segment: onWatchlist ? ('watchlist' as const) : ('pre-token' as const),
      age_days: s.m.age,
      implied_value_usd: s.m.implied,
      reason: rowReason(p, s.m),
      model: {
        base_multiple: model.base_multiple,
        growth_pct: s.m.growthPct,
        growth_multiplier: round4(s.m.growthMult),
        maturity_multiplier: round4(s.m.maturityMult),
        category_weight: round4(s.m.categoryWeight),
        chain_weight: round4(s.m.chainWeight),
        category_ratio: s.m.categoryRatio,
        chain_ratio: s.m.chainRatio,
        global_ratio: weights.global_ratio,
        age_days: s.m.age,
      },
      farm_steps: farmSteps(p, s.m.age).map(stepText),
    };
  });
}

/** A short, deterministic reason: what moved this row up or down the board. */
export function rowReason(p: SnapshotProtocol, m: ReturnType<typeof impliedValue>): string {
  const size = p.tvl_usd >= 1e9 ? `${round2(p.tvl_usd / 1e9)}B TVL` : `${Math.round(p.tvl_usd / 1e6)}M TVL`;
  const growth = p.change_7d === null ? 'no 7d change reported' : `${m.growthPct >= 0 ? '+' : ''}${round2(m.growthPct)}% 7d`;
  const age = m.age === null ? 'age not reported' : ageLabel(m.age);
  const cat = (p.category ?? 'Uncategorised').toLowerCase();
  const parts = [`${size}`, growth, `${age} recording no token`, `${cat} multiple ${round2(m.categoryWeight)}x`, `${chainOf(p)} ${round2(m.chainWeight)}x`];
  return parts.join(', ') + '.';
}

/** "3.2y" or "128d" for an age in days. */
function ageLabel(days: number): string {
  return days >= 365 ? `${(days / 365).toFixed(1)}y with no token` : `${days}d with no token`;
}

// ------------------------------------------------------------------ farm plans

/** The category buckets a plan is built from, in the order they are matched. */
interface Playbook {
  readonly action: (ctx: PlanContext) => string;
  readonly second: (ctx: PlanContext) => string;
  readonly keep: (ctx: PlanContext) => string;
}

interface PlanContext {
  name: string;
  chain: string;
  capital: number;
  hold: number;
  gas: string;
}

const playbookOf = (category: string | null): Playbook => {
  const c = (category ?? '').toLowerCase();
  if (c.includes('cross chain bridge')) return BRIDGE;
  if (c.includes('canonical bridge')) return BRIDGE;
  if (c.includes('bridge')) return BRIDGE;
  if (c.includes('cex')) return CEX_PLAY;
  if (c.includes('liquid stak') || c.includes('liquid restak') || c.includes('restak')) return STAKING;
  if (c.includes('restaked btc') || c.includes('anchor btc') || c.includes('decentralized btc')) return BTC_YIELD;
  if (c.includes('staking pool') || c.includes('staking')) return STAKING;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return LENDING;
  if (c.includes('rwa') || c.includes('real world')) return RWA;
  if (c.includes('risk curator')) return CURATOR;
  if (c.includes('capital allocator')) return ALLOCATOR;
  if (c.includes('dex') || c.includes('amm') || c.includes('leveraged farm') || c.includes('farm')) return DEX;
  if (c.includes('yield') || c.includes('vault')) return YIELD;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('basis') || c.includes('synthetic') || c.includes('algo-stable')) return DERIVATIVES;
  if (c.includes('prediction')) return PREDICTION;
  if (c.includes('insurance')) return INSURANCE;
  if (c.includes('index')) return INDEX;
  if (c.includes('stable') || c.includes('reserve')) return STABLE;
  if (c.includes('launchpad') || c.includes('governance') || c.includes('incentive') || c.includes('token locker') || c.includes('locker')) return INCENTIVE;
  if (c.includes('ai') || c.includes('nft') || c.includes('payment') || c.includes('privacy') || c.includes('card')) return APP;
  return GENERIC;
};

const BRIDGE: Playbook = {
  action: (c) => `Treat ${c.name} as a bridge, not a farm target: do not park capital in it hoping for a token drop.`,
  second: (c) => `If you must move funds, send only the amount you need across ${c.name} to ${c.chain} and withdraw the same day.`,
  keep: (c) => `Recheck once a season whether ${c.name} has published a token plan; until it does, its fee flow, not a drop, is its story.`,
};
const CEX_PLAY: Playbook = {
  action: (c) => `Keep ${c.name} on a watchlist only: a custodial venue has no on-chain position to farm, so commit no capital.`,
  second: (c) => `If you already hold there, move the balance to self-custody and earn elsewhere until ${c.name} states a token plan.`,
  keep: (c) => `Watch ${c.name}'s announcements for a points programme you can join without depositing new money.`,
};
const STAKING: Playbook = {
  action: (c) => `Stake $${c.capital} of the native asset through ${c.name} on ${c.chain} and hold the receipt token it returns.`,
  second: (c) => `Deploy that receipt once in a second venue only if ${c.name} itself counts the re-stake; otherwise leave it idle.`,
  keep: (c) => `Restake or top up $${c.capital} each reward cycle so ${c.name} sees an active position every epoch.`,
};
const BTC_YIELD: Playbook = {
  action: (c) => `Deposit $${c.capital} of BTC into ${c.name} on ${c.chain} and hold the yield-bearing receipt it mints.`,
  second: (c) => `Read ${c.name}'s custody and vault terms before you sign, and keep the deposited BTC in one address you can audit.`,
  keep: (c) => `Claim and restake the ${c.name} yield each month so the position stays active and compounding.`,
};
const LENDING: Playbook = {
  action: (c) => `Supply $${c.capital} of USDC to ${c.name} on ${c.chain} and keep the position open for the whole window.`,
  second: (c) => `Borrow a small, safe fraction against the supply and repay it monthly so ${c.name} sees a borrower as well as a lender.`,
  keep: (c) => `Touch the market every week: a small supply, a repay or a vote, so the wallet is never dormant.`,
};
const RWA: Playbook = {
  action: (c) => `Mint $${c.capital} of ${c.name}'s yield asset on ${c.chain} after its allowlist or KYC step clears.`,
  second: (c) => `Hold the receipt or deposit it in ${c.name}'s own vault so the position earns the underlying yield.`,
  keep: (c) => `Check ${c.name}'s redemption and eligibility rules monthly and roll the position as terms change.`,
};
const CURATOR: Playbook = {
  action: (c) => `Deposit $${c.capital} into a ${c.name} vault on ${c.chain} and keep the vault shares.`,
  second: (c) => `Choose a vault whose strategy you can name, and split the deposit across two of ${c.name}'s vaults at most.`,
  keep: (c) => `Track the vault's share price weekly and move to another ${c.name} vault if the fee or the risk drifts.`,
};
const ALLOCATOR: Playbook = {
  action: (c) => `Deposit $${c.capital} into ${c.name} on ${c.chain} so the allocator routes it into its earn vault.`,
  second: (c) => `Confirm which venues ${c.name} spreads the deposit across, and keep the receipt where you can see it.`,
  keep: (c) => `Review ${c.name}'s allocation quarterly and top up or withdraw a little so the position stays live.`,
};
const DEX: Playbook = {
  action: (c) => `Provide $${c.capital} of liquidity to ${c.name}'s deepest pool on ${c.chain} and keep the position open.`,
  second: (c) => `Route a small swap through ${c.name} each week so the wallet counts as a trader as well as an LP.`,
  keep: (c) => `Rebalance once a month if the pair drifts, and re-read the fee tier before you add again.`,
};
const YIELD: Playbook = {
  action: (c) => `Deposit $${c.capital} into ${c.name}'s main vault on ${c.chain} and hold the vault token.`,
  second: (c) => `Check where ${c.name} farms that vault, and, if it counts, deposit the vault token there too.`,
  keep: (c) => `Compound the vault each month and keep an eye on the vault's cap before the position is priced out.`,
};
const DERIVATIVES: Playbook = {
  action: (c) => `Deposit $${c.capital} of collateral on ${c.name} on ${c.chain} and open one small, hedged position.`,
  second: (c) => `Trade a tiny delta-neutral leg, a basis or a hedged perp, so ${c.name} sees real flow from the wallet.`,
  keep: (c) => `Fund the margin buffer weekly and close the position well before the farm window ends, never let it liquidate.`,
};
const PREDICTION: Playbook = {
  action: (c) => `Fund $${c.capital} on ${c.name} on ${c.chain} and place one resolved-soon market position.`,
  second: (c) => `Add liquidity to a ${c.name} market, not just a bet, so the wallet provides flow as well as takes it.`,
  keep: (c) => `Settle or roll the position each week and withdraw winnings so the balance stays active.`,
};
const INSURANCE: Playbook = {
  action: (c) => `Buy $${c.capital} of cover from ${c.name} on ${c.chain} for a position you already hold.`,
  second: (c) => `If ${c.name} has an underwriting side, supply a little there too, and keep both positions open.`,
  keep: (c) => `Renew or extend the policy monthly and note the covered address so the position is traceable.`,
};
const INDEX: Playbook = {
  action: (c) => `Mint $${c.capital} of ${c.name}'s index basket on ${c.chain} and hold the receipt.`,
  second: (c) => `Hold the basket at least one rebalance so the position is counted across two snapshots.`,
  keep: (c) => `Follow ${c.name}'s rebalances monthly and top up a little when the weights change.`,
};
const STABLE: Playbook = {
  action: (c) => `Mint or deposit $${c.capital} of the stable asset through ${c.name} on ${c.chain}.`,
  second: (c) => `Stake or lend the stable it returns in the same venue if ${c.name} counts it; otherwise hold it plainly.`,
  keep: (c) => `Watch the peg and the collateral weekly, and unwind at the first sign of a depeg.`,
};
const INCENTIVE: Playbook = {
  action: (c) => `Join ${c.name}'s programme on ${c.chain} with $${c.capital} once its rules and dates are public.`,
  second: (c) => `Vote or lock the minimum that qualifies, and keep the receipt or lock NFT in one wallet.`,
  keep: (c) => `Recheck ${c.name}'s incentive page weekly while the programme runs and roll the lock if it extends.`,
};
const APP: Playbook = {
  action: (c) => `Use ${c.name} on ${c.chain} with $${c.capital}: do the one action its own points page credits.`,
  second: (c) => `Come back weekly and repeat that action so ${c.name} records a returning user, not a one-off.`,
  keep: (c) => `Watch ${c.name}'s own announcements for the actions it will count, and adjust the weekly habit.`,
};
const GENERIC: Playbook = {
  action: (c) => `Deposit $${c.capital} of USDC into ${c.name} on ${c.chain} and keep the position open.`,
  second: (c) => `Do the one on-chain action ${c.name}'s own page credits, then leave the deposit in place.`,
  keep: (c) => `Return weekly for a small deposit, withdrawal or vote so the wallet stays visible to ${c.name}.`,
};

/** A cheap or an expensive chain, from the chain's name alone, for the gas lines. */
function gasOf(chain: string): { light: string; heavy: string; label: string } {
  const cheap = ['Solana', 'Base', 'Arbitrum', 'Optimism', 'Polygon', 'BNB', 'Binance', 'Avalanche', 'Sui', 'Monad', 'Hyperliquid L1', 'Plasma', 'Tron', 'Aptos', 'Sonic', 'Berachain', 'Unichain', 'Linea', 'Scroll', 'Blast', 'Mantle', 'Celo', 'Ripple'];
  if (cheap.includes(chain)) return { light: 'under $0.30 of gas', heavy: 'about $0.60 of gas', label: 'low-fee' };
  if (chain === 'Ethereum') return { light: 'about $6 of gas', heavy: 'about $12 of gas', label: 'high-fee' };
  return { light: 'about $2 of gas', heavy: 'about $5 of gas', label: 'mid-fee' };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(tvl: number): number {
  if (tvl >= 5_000_000_000) return 250;
  if (tvl >= 1_000_000_000) return 150;
  if (tvl >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * A protocol's farm plan: five to eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, first chain, TVL, age), never from a hand-written
 * list of names, and the middle steps come from the category's own playbook so a lending plan differs
 * from a DEX plan, an RWA plan, a curator plan and a bridge's "do not" note.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasOf(chain);
  const ctx: PlanContext = {
    name: p.name,
    chain,
    capital: capitalFor(p.tvl_usd),
    hold: holdDaysFor(age),
    gas: gas.label,
  };
  const play = playbookOf(p.category);
  const isBridge = play === BRIDGE;
  const steps: FarmStep[] = [
    {
      text: `Make a fresh wallet that holds only the $${ctx.capital} you plan to farm, keep its seed phrase offline, and never reuse a wallet that already farms another protocol.`,
      cost: `${gas.light} to fund it`,
      time: '5 minutes',
    },
    {
      text: play.action(ctx),
      cost: `$${ctx.capital} of capital plus ${gas.heavy}`,
      time: '15 minutes to set up',
    },
    {
      text: play.second(ctx),
      cost: isBridge ? `${gas.light} to withdraw` : `about $${ctx.capital >= 150 ? 6 : 3} of fees over the window`,
      time: isBridge ? 'the same day' : '20 minutes',
    },
    {
      text: play.keep(ctx),
      cost: isBridge ? 'nothing but the check' : `around $1 to $3 of gas each visit`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${ctx.hold} days so ${p.name} sees the activity in more than one of its snapshots, then only withdraw what you do not mean to farm again.`,
      cost: isBridge ? 'no capital is parked' : `the $${ctx.capital} stays in the position`,
      time: `${ctx.hold} days`,
    },
    {
      text: `Before claiming anything, open ${p.name}'s own rewards or points page and claim only through the address it publishes itself; never sign a claim from a link sent to you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Log the wallet address, the ${chain} chain, every deposit and withdrawal and the dates in a file, so the position can be repeated or unwound without guesswork.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  if (!isBridge) {
    steps.splice(4, 0, {
      text: `Keep at least $${Math.max(25, Math.round(ctx.capital / 4))} of unencumbered USDC in the wallet as a buffer, so a losing leg, a liquidation or a withdrawal fee never closes the position early.`,
      cost: `$${Math.max(25, Math.round(ctx.capital / 4))} held in reserve`,
      time: 'set once',
    });
  }
  return steps;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and read the protocol's own page.`;
  return s;
}

// ------------------------------------------------------------------ live and radar

/** One Live-view row from a protocol: a live token, or a product of one that trades. */
function liveRow(p: SnapshotProtocol, kind: 'live' | 'product'): LiveRow {
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
    change_7d: p.change_7d,
    kind,
    product_reason: kind === 'product' ? productOfTradingToken(p) : null,
  };
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot, cap = 60): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, cap)
    .map((p) => liveRow(p, 'live'));
}

/**
 * Every protocol that records no token yet is a wrapped, staked, bridged or versioned product of one
 * that already trades, by TVL. These are set off the board and shown in the Live view's product list,
 * each with the reason it is not a launch target of its own.
 */
export function productRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && productOfTradingToken(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => liveRow(p, 'product'));
}

/** A board row's compact form for data.js, farm plan included. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    chain: row.chain,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    on_watchlist: row.on_watchlist,
    segment: row.segment,
    reason: row.reason,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_weight: row.model.category_weight,
    chain_weight: row.model.chain_weight,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const weights = deriveWeights(snapshot, model);
  const board = buildBoard(snapshot, model, weights);
  const live = liveRows(snapshot);
  const products = productRows(snapshot);
  const watchlistRows = board.filter((r) => r.on_watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    protocol_count: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    watchlist_rows: watchlistRows,
    early_size: board.length - watchlistRows,
    pre_token_size: board.length,
    live_size: live.length,
    product_size: products.length,
    weights,
    rows: board.map(radarRow),
    live,
    products,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const snapshotSlugs = new Set(snapshot.protocols.map((p) => p.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the gate's 100`;
  if (board.length > 4000) return `the board holds ${board.length} rows, over the gate's 4,000`;
  for (const r of board) {
    if (r.slug.length < 1 || r.slug.length > 128 || /\s/.test(r.slug)) return `slug "${r.slug}" is not 1 to 128 characters without whitespace`;
    if (!snapshotSlugs.has(r.slug)) return `slug "${r.slug}" is not one of the snapshot's protocols`;
    if (r.name.length === 0) return `slug "${r.slug}" has an empty name`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value over the gate's 1e14`;
  }
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
