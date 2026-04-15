# YieldNest Demo UI — status

The forked dashboard lives in the sibling repo
[`willow-network/yieldnest-willow-dashboard`](https://github.com/willow-network/yieldnest-willow-dashboard).

## What's live

- All 6 pages render live data from the Willow indexer via GraphQL.
- Real TVL in USD via on-chain `totalAssets()` calls + Coingecko spot prices.
- ProofBadge → Merkle-proof viewer modal on every per-entity row.
- Live tip-pulse widget on Overview (mainnet tip vs last yn-event).
- MetaMask Connect Wallet on Portfolio.
- Light/dark theme toggle; Willow-green accents; YieldNest logo.

## Known gaps

- `yieldnest-vaults-bnb`, `yieldnest-vaults-l2` — no data (Willow indexer
  has no BNB / OP RPC path yet).
- `yieldnest-liquidity` — no data (needs a WASM handler for pool math +
  real pool addresses).
- `yieldnest-restaking-eth` — pipeline at tip but contracts are low-traffic,
  often 0 events in the indexed window. Widened or not, this is honest.

## Architecture

```
browser (http://127.0.0.1:5273)
  │
  ├── /willow-api  ────→ willow API (:3031)           subgrove metadata
  ├── /indexer-gql ────→ willow-indexer (:3051)       decoded entities + proofs
  ├── /cometbft-rpc ───→ cometbft (:26657)             chain status
  └── /eth-rpc     ────→ Alchemy mainnet              totalAssets() + tip
```

Alchemy key lives in `yieldnest-willow-dashboard/.env.local` (gitignored).
