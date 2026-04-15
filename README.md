# YieldNest × Willow Explorer

Forked from `willow-explorer-web` — YieldNest-branded dashboard that renders
YieldNest protocol state exclusively from Willow subgroves, with
proof-verification on every query.

## Subgroves consumed

See `../willow/partners/yieldnest/` for manifests. This app queries:

- `yieldnest-vaults-eth`, `-bnb`, `-l2` — vault TVL/APY/positions
- `yieldnest-restaking-eth` — StakingNodesManager + EL/CL + EigenLayer
- `yieldnest-liquidity` — DEX depth + slippage for Risk Radar
- `yieldnest-governance` — YND supply + delegations

## Dev

```bash
npm install
npm run dev
# opens http://localhost:5173
```

Set the Willow node URL via `VITE_WILLOW_NODE` env (defaults to the managed
endpoint at api.willow.tech).

## Status

Pages scaffolded with placeholders; next step is wiring each panel to
`@willow/sdk` queries against the live subgroves once the registration
transactions land.
