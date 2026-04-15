# willow-yieldnest

Private, canonical repo for the YieldNest × Willow partnership. Everything
lives here: protocol/indexer configs, schemas, bringup scripts, and the
YieldNest-branded dashboard UI.

## Layout

```
.
├── protocol/     # subgroves, schemas, indexer.toml, bringup_demo.sh, register-rs
└── dashboard/    # @yieldnest/explorer-web — Vite + React UI (fork of willow-explorer-web)
```

Expected sibling clone on disk:

```
~/<anywhere>/
├── willow/                # willow-network/willow (core protocol)
└── willow-yieldnest/      # this repo
```

## Local bring-up

```bash
# 1. Start local 3-node Willow devnet + register + fund 6 subgroves
./protocol/scripts/bringup_demo.sh

# 2. Start the indexer
../willow/target/release/willow-indexer start \
  --config ./protocol/indexer/indexer.toml

# 3. Start the dashboard
cd dashboard
cp .env.example .env.local   # fill in Alchemy key
npm install && npm run dev
# → http://127.0.0.1:5273
```

See `protocol/README.md` and `dashboard/README.md` for specifics.

## Contents

### `protocol/`
Six subgroves (all `ExecutionMode::GkrExecution`):
`yieldnest-vaults-eth`, `yieldnest-vaults-bnb`, `yieldnest-vaults-l2`,
`yieldnest-restaking-eth`, `yieldnest-liquidity`, `yieldnest-governance`.
Matching GraphQL SDL schemas. A `bringup_demo.sh` end-to-end script and a
Rust `register-rs` binary for subgrove registration + funding.

### `dashboard/`
Six pages — Overview, Earn, Portfolio, Risk Radar, Restaking, Governance —
all live-wired to the indexer's GraphQL + the Willow REST API via Vite
proxies. Charts in Recharts. Clickable proof viewer on every per-entity
row (shows the Merkle proof returned alongside the query). MetaMask
Connect Wallet. Per-vault TVL in USD from on-chain `totalAssets()` +
Coingecko spot prices. Light/dark theme toggle.

## Secrets

- `dashboard/.env.local` — Alchemy key, gitignored
- `protocol/indexer/indexer.toml` — hard-codes RPC URLs including paid
  Alchemy key. Acceptable because this repo is private; rotate before
  any sharing.
