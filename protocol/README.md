# willow-yieldnest / protocol

Private partner configuration for YieldNest × Willow (subgroves, schemas,
bringup scripts, indexer config). The dashboard that consumes these
subgroves lives in the sibling `../dashboard/` directory.

Companion to:
- **`willow-network/willow`** — core protocol (expected as a sibling clone)

## Layout

```
.
├── subgroves/          # 6 subgrove registration manifests (JSON)
├── schemas/            # GraphQL SDL entity schemas per subgrove family
├── scripts/
│   ├── bringup_demo.sh # one-shot: devnet + subgrove registration
│   └── register-rs/    # Rust binary that registers all 6 via willow-sdk
├── indexer/
│   └── indexer.toml    # willow-indexer config (does NOT track grovedb/)
└── wasm-handlers/      # (stub) custom transformation modules
```

## Subgroves

All registered with `ExecutionMode::GkrExecution`. Every indexer submission
carries a GKR proof verified on-chain.

| Subgrove                   | Chain(s)       | Covers                                         |
|----------------------------|----------------|------------------------------------------------|
| `yieldnest-vaults-eth`     | Ethereum       | ynETH, ynLSDe, ynETHx, ynUSDx, ynRWAx          |
| `yieldnest-vaults-bnb`     | BNB Chain      | ynBNB, ynBNBx, ynBTCk *(awaiting BNB RPC)*     |
| `yieldnest-vaults-l2`      | OP/Base/etc    | MAX vault mirrors *(awaiting L2 RPC wiring)*   |
| `yieldnest-restaking-eth`  | Ethereum       | StakingNodesManager, EL/CL receivers           |
| `yieldnest-liquidity`      | Ethereum       | Curve/Uniswap pools *(awaiting WASM handler)*  |
| `yieldnest-governance`     | Ethereum       | YND ERC-20 transfers, delegations              |

Live state: vaults-eth + governance catching up to tip; restaking-eth at tip
but low-traffic so rarely emits. BNB/L2 pipelines idle pending cross-chain
RPC support in Willow.

## Bring up a local demo

```bash
./scripts/bringup_demo.sh
# devnet starts (3 validator nodes), 6 subgroves register as
# did:willow:validator1, then waits. Ctrl-C to stop.

# in another shell — start the indexer:
../willow/target/release/willow-indexer start \
  --config ./indexer/indexer.toml

# in another shell — start the dashboard:
cd ../dashboard
cp .env.example .env.local   # paste Alchemy key
npm install && npm run dev
# http://127.0.0.1:5273
```

## Secrets

The indexer config uses hardcoded public RPC endpoints. For paid providers
(Alchemy, Infura, QuickNode) put the URL in `indexer.toml` directly. This
repo is private so that's acceptable. If this repo is ever opened up,
move RPC URLs to env vars first.

## Upstream blockers

Tracked so partner engineers can file issues on willow-network/willow:
- **`SubgroveIndexingInfo` missing `description` field** — registration passes
  a description but read path in `crates/storage/src/permissions.rs:353`
  hardcodes `""`. Needs a schema + migration.
- **GraphQL executor selection-merge bug** — aliased queries like
  `allDeposits: deposits` merge field selections with the non-aliased
  `deposits`. Workaround: split into separate top-level queries.
- **Cross-chain RPC support** — indexer.toml only has `eth_rpc_endpoints`;
  BNB / OP / other L2 pipelines can't fetch.
- **Subgrove funding** — our subgroves are unfunded, so consensus-side
  block-update submissions fail (`Subgrove has insufficient balance`).
  Historical GraphQL works, but the consensus checkpoint story is partial.
  `register-rs` needs a `--fund` flag.
