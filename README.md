# Token Radar

A token-launch radar for the **make.fun `token-radar-01`** bounty. It reads one frozen DefiLlama
snapshot of the protocol universe, finds every protocol whose record carries no token and that stands
on its own, ranks them by an **implied value** derived from the snapshot alone, and shows a reader how
to farm each one. The result is a static dashboard with no framework and no network.

## What it makes

- `board.json` — the ranked board: `{ "rows": [...] }`, one row per pre-token launch candidate, ranks
  `1..N` by implied value, each row with its model inputs, a short reason and a farm plan.
- `data.js` — the page's whole dataset, written beside the page (`window.RADAR = {...}`).
- `dashboard/` — `index.html`, `app.css`, `app.js`: the static page, copied verbatim to the output.
- `screenshots/` — three renders of the page: the board, a protocol's detail view, and a filtered view.
- `dossier.json` — the summary the judge reads, written last by `buildDossier` from
  `vendor/makefun-board.ts`.

## Run it

Node 22, standard library only, no installs and no network.

```bash
# inside the grader: reads /input/snapshot.json, writes /output
node main.ts

# outside the grader: MAKEFUN_OUTPUT_DIR stands in for /output
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

`--input <file|dir>` defaults to `/input`; `--output <dir>` (or `MAKEFUN_OUTPUT_DIR`) defaults to
`/output`. The program is deterministic: no clock, no randomness, so two runs write byte-identical
output. Before it writes anything, it checks its own board against the gate (`boardIssue`) and exits `1`
with a clear message when the board would fail.

## The model

One function scores every row; no protocol name is special-cased. Constants live in `MODEL`
(`lib/model.ts`) and are stated on the page and here.

```
globalRatio   = median over the live-token protocols of ( mcap_usd / tvl_usd )
categoryRatio = shrink( median mcap/tvl in the row's category , to globalRatio , n = 12 )
chainRatio    = shrink( median mcap/tvl on the row's first chain , to globalRatio , n = 12 )
categoryWeight= clamp( categoryRatio / globalRatio , 0.55 , 1.75 )
chainWeight   = clamp( chainRatio    / globalRatio , 0.75 , 1.30 )

base          = tvl_usd x 0.2
growth        = clamp( change_7d , -60 , 120 ) %          growthMult = 1 + growth/100 x 0.5
age_days      = whole days since listed_at , else 365      maturity   = 0.6 + min(age,1095)/1095 x 0.4
implied       = max(1, round( base x growthMult x maturity x categoryWeight x chainWeight ))
```

- **Coverage.** The board is every protocol in the snapshot's `watchlist` (the house's floor, never a
  ceiling) plus every other protocol that records no token and is not a product of one that trades.
  A protocol is *pre-token* when its record carries no market cap, no CoinGecko id and no symbol: the
  radar says the record carries no token, never that the protocol has none.
- **Set aside.** Two groups are kept off the board and listed under the board instead: the protocols
  whose token already trades, and the wrapped, staked, bridged or versioned products of such a protocol
  (the house's own exclusion rule, one function, no name special-cased). Neither is a launch of its own.
- **Category and chain weights** are read from the snapshot's own live-token rows and shrunk toward the
  global ratio, so a group with few live samples never moves a weight on its own.

## The farm plan

Each row carries 7–8 steps, each with a cost and a time, derived from the protocol's own record
(category, first chain, TVL, age). The middle steps come from a per-category playbook, so a lending plan
(supply / borrow / repay) differs from a DEX plan (LP / route a swap), an RWA plan (mint after KYC),
a curator plan (vault shares), a staking plan and a bridge's "do not park capital here" note. Cost and
hold figures scale with the protocol's TVL and age; nothing is a slogan reused for every row.

## The page

`dashboard/index.html` + `app.css` + `app.js` render the ranked board (rank, name, category, chain, TVL,
7-day change, time with no token, implied value with a bar, and the reason), filters by category, chain,
segment and minimum TVL, free-text search, sortable columns, a detail drawer for every protocol with its
implied-value arithmetic and its farm plan, the stated model with its derived weights, a deep link
(`#row-<slug>` or `?detail=<slug>`), and the Live view of trading tokens and set-aside products.

## Layout

```
main.ts                     entry point: read, score, write, copy, dossier
lib/model.ts                the model, the farm plans, the board and the parser
vendor/makefun-board.ts     the scorer's own dossier library (copied from the kit, unchanged)
dashboard/                  the static page
screenshots/                three renders of the page
.makefun/owner.json         the payout wallet
LICENSE                     MIT
```

## License

MIT. See `LICENSE`.
