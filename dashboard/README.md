# YieldNest dashboard

A YieldNest analytics dashboard that renders protocol state entirely from Willow subgroves, and re-verifies every per-entity row's Merkle proof in the browser. See the [top-level README](../README.md) for the what and why, and [FORK.md](../FORK.md) to adapt it to your own contracts.

## Pages

- **Overview** — per-subgrove entity counts, live tip-pulse, deposit feed
- **Earn** — total TVL (USD, live from `totalAssets()` + spot prices), cumulative deposits, top depositors, per-vault table
- **Portfolio** — paste an address or connect a wallet (MetaMask) to see per-user deposits, withdrawals, transfers
- **Risk Radar** — activity-derived radar: deposit velocity, owner spread, recency, restaking flow
- **Restaking** — `yieldnest-restaking-eth` transfer volume, largest senders
- **Governance** — YND transfer volume, top holders, recent transfers

Every row with a per-entity proof shows a clickable **Willow verified** badge. It opens the proof viewer, which recomputes the GroveDB Merkle root in your browser and checks it against the committed state root (green ✓ / red ✗), alongside the raw proof and response.

## Subgroves consumed

Manifests live in [`../protocol/`](../protocol). This app queries:

- `yieldnest-vaults-eth` — vault events (Deposit / Withdraw / Transfer) for the five Ethereum vaults (ynETH, ynLSDe, ynETHx, ynUSDx, ynRWAx)
- `yieldnest-restaking-eth` — StakingNodesManager + restaking receivers
- `yieldnest-liquidity` — liquidity pools (pool-math handler pending)
- `yieldnest-governance` — YND ERC-20 transfers

All index Ethereum mainnet.

## Dev

A local Willow node + indexer must be running (see [`../protocol/scripts/bringup_demo.sh`](../protocol/scripts/bringup_demo.sh)). Copy `.env.example` → `.env.local`, then:

```bash
npm install
npm run dev   # http://127.0.0.1:5273
```

The dev server proxies:

| path            | → target                | why                                 |
|-----------------|-------------------------|-------------------------------------|
| `/willow-api`   | http://127.0.0.1:3031   | subgrove metadata (REST)            |
| `/indexer-gql`  | http://127.0.0.1:3051   | decoded entity GraphQL + proofs     |
| `/cometbft-rpc` | http://127.0.0.1:26657  | chain status                        |
| `/eth-rpc`      | Ethereum RPC            | `totalAssets()` + chain-tip polling |

Override any endpoint by setting the matching `VITE_` var in `.env.local` (see `.env.example`).

## Build & deploy

```bash
npm run build       # → dist/
npm run typecheck
```

It's a static SPA — any static host works (`public/_redirects` provides the SPA fallback). `@willow/sdk` is vendored under `vendor/willow-sdk/` so a build host needs no sibling `willow` checkout. Deployment steps and env vars are in [FORK.md](../FORK.md).

## Status

All six pages render live data from the indexer (Ethereum mainnet). Next up: a pool-math handler for `yieldnest-liquidity`.
