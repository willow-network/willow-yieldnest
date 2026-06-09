# YieldNest × Willow Dashboard

YieldNest-branded dashboard that renders YieldNest protocol state exclusively
from Willow subgroves, with cryptographic proof verification on every query.
Forked from `willow-explorer-web`.

## Pages

- **Overview** — per-subgrove entity counts, live tip-pulse, deposit feed
- **Earn** — total TVL (USD, live from `totalAssets()` + Coingecko), cumulative deposits, top depositors, per-vault table
- **Portfolio** — paste an address or **Connect Wallet** (MetaMask) to see per-user deposits, withdrawals, transfers
- **Risk Radar** — activity-derived radar: deposit velocity, owner spread, recency, restaking flow
- **Restaking** — `yieldnest-restaking-eth` transfer volume, largest senders
- **Governance** — YND transfer volume, top holders, recent transfers

Every row with a per-entity proof shows a clickable **Willow verified** badge
that opens the Merkle proof viewer — state root, block height, Ethereum anchor,
full JSON response.

## Subgroves consumed

Configs live in the sibling `../protocol/` directory. This app queries:

- `yieldnest-vaults-eth` — vault events (Deposit / Withdraw / Transfer) for the
  five Ethereum vaults (ynETH, ynLSDe, ynETHx, ynUSDx, ynRWAx)
- `yieldnest-restaking-eth` — StakingNodesManager, RewardsDistributor, EL/CL receivers
- `yieldnest-liquidity` — DEX pools (WASM handler pending)
- `yieldnest-governance` — YND ERC-20 token (GKR-proven voting power)

All subgroves index Ethereum mainnet (L1). The BSC (`-bnb`) and L2 (`-l2`) vault
subgroves were dropped — those were the only chains we can't beacon-verify and
they accounted for ~95% of the RPC bill.

## Dev

Copy `.env.example` → `.env.local` and fill in the Alchemy key, then:

```bash
npm install
npm run dev
# http://127.0.0.1:5273
```

A local Willow node + indexer must be running (see
`../protocol/scripts/bringup_demo.sh`). The dev server proxies:

| path              | → target                     | why                                   |
|-------------------|------------------------------|---------------------------------------|
| `/willow-api`     | http://127.0.0.1:3031        | subgrove metadata (REST)              |
| `/indexer-gql`    | http://127.0.0.1:3051        | decoded entity GraphQL                |
| `/cometbft-rpc`   | http://127.0.0.1:26657       | chain status                          |
| `/eth-rpc`        | Alchemy mainnet              | `totalAssets()` + chain-tip polling   |

## Build

```bash
npm run build
npm run typecheck
```

## Deploy to yieldnest.willow.tech

Served from **Cloudflare Pages**, git-connected to this repo
(`willow-network/willow-yieldnest`) with `dashboard/` as the build root and
`origin/main` as the production branch. Push to `main` and CF Pages builds and
deploys automatically — there is no EC2 / nginx / rsync step anymore.

The browser calls the public endpoints directly (all CORS-open), baked in at
build time via `.env.production`:

```
VITE_WILLOW_API=https://api.willow.tech
VITE_INDEXER_GQL=https://indexer.willow.tech
VITE_ETH_RPC=https://ethereum.publicnode.com
```

`public/_redirects` provides the SPA fallback. `@willow/sdk` is vendored under
`dashboard/vendor/willow-sdk/` so CF (which has no sibling `../../willow`
checkout) can build it.

## Status

All 6 pages render live data from the indexer (Ethereum L1 only). Next up:
- WASM handler for `yieldnest-liquidity` (real pool math)
