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

Configs live in the private `willow-yieldnest` repo. This app queries:

- `yieldnest-vaults-eth` / `-bnb` / `-l2` — vault events (Deposit / Withdraw / Transfer)
- `yieldnest-restaking-eth` — StakingNodesManager, RewardsDistributor, EL/CL receivers
- `yieldnest-liquidity` — DEX pools (WASM handler pending)
- `yieldnest-governance` — YND ERC-20 token

## Dev

Copy `.env.example` → `.env.local` and fill in the Alchemy key, then:

```bash
npm install
npm run dev
# http://127.0.0.1:5273
```

A local Willow node + indexer must be running (see the `willow-yieldnest`
repo's `bringup_demo.sh`). The dev server proxies:

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

## Status

All 6 pages render live data from the indexer. Next up:
- BNB + Optimism chain support for the currently-empty bnb/l2 subgroves
- WASM handler for `yieldnest-liquidity` (real pool math)
- Deploy behind `api.willow.tech` (AWS) for a shared demo endpoint
