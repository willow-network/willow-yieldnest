# YieldNest WASM handlers

Custom transformation modules for subgroves that don't fit declarative
ERC-4626 / ERC-20 indexing.

## Planned

### `liquidity`
Pool snapshots with Curve / Uniswap v3 / Pancake math:
- Reserves from pool state
- Synthetic slippage curve at 1k / 10k / 100k notional
- TVL in USD via price oracle

### `vaults-l2`
Unified `VaultSnapshot` stream keyed by `(chainId, vault, blockNumber)`
across the same contract address on multiple L2s.

### `governance`
Holder count + top-holder share aggregates — derived, not event-scraped.

## Status

Not yet implemented. Toolchain decision pending (AssemblyScript like The
Graph, or Rust→wasm). Willow consensus verifies `WasmModule::hash` (SHA-256)
against uploaded bytecode, so the protocol side is ready.

## Build target

Artefacts go in `./dist/`, sha256-summed, passed via the register binary
(`register-rs` needs a `--wasm` flag to include them in the tx).
