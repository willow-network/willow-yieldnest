# protocol

The Willow indexing layer behind the dashboard: subgrove manifests, GraphQL schemas, and the indexer config. The dashboard that consumes these lives in [`../dashboard/`](../dashboard).

## Layout

```
.
├── subgroves/        # subgrove registration manifests (JSON)
├── schemas/          # GraphQL SDL entity schemas, per subgrove family
├── scripts/
│   ├── bringup_demo.sh   # one-shot: local devnet + subgrove registration
│   └── register-rs/      # Rust tool that registers/funds subgroves via willow-sdk
├── indexer/
│   └── indexer.toml      # willow-indexer config
└── wasm-handlers/        # custom transformation modules (e.g. pool math)
```

## Subgroves

A subgrove is a declarative description of what to index — a set of contracts, their ABIs, and the events to decode. Each manifest under `subgroves/` has a matching GraphQL schema under `schemas/`. The live set:

| Subgrove                  | Covers                                            |
|---------------------------|---------------------------------------------------|
| `yieldnest-vaults-eth`    | ynETH, ynLSDe, ynETHx, ynUSDx, ynRWAx (ERC-4626)  |
| `yieldnest-restaking-eth` | StakingNodesManager + restaking receivers         |
| `yieldnest-liquidity`     | Liquidity pools *(awaiting a pool-math handler)*  |
| `yieldnest-governance`    | YND ERC-20 transfers                              |

`uniswap-v3-eth-usdc.json` is a generic, non-YieldNest example manifest (a Uniswap V3 ETH/USDC pool), kept as a reference.

## Bring up a local demo

```bash
./scripts/bringup_demo.sh
# starts a local devnet, registers the subgroves, then waits. Ctrl-C to stop.

# in another shell — start the indexer:
willow-indexer start --config ./indexer/indexer.toml

# in another shell — start the dashboard:
cd ../dashboard
cp .env.example .env.local
npm install && npm run dev   # http://127.0.0.1:5273
```

`bringup_demo.sh` runs against a local Willow devnet and needs the core [`willow`](https://github.com/willow-network/willow) binaries. To adapt any of this to your own contracts and network, see [`../FORK.md`](../FORK.md).
