# Build your own Willow-verified dashboard

This dashboard reads from **subgroves** — declarative descriptions of what to index on-chain — and re-verifies every number in the browser against a committed state root. None of that is YieldNest-specific. Point a subgrove at any contract and you get the same click-to-verify dashboard for your own protocol.

This guide takes you from a fresh fork to a running, verified view of your own contracts.

## Prerequisites

- **Node 18+** and **npm** (for the dashboard).
- **Rust** (stable) — for the `register-rs` subgrove registration tool under `protocol/scripts/`.
- A **Willow node + indexer** to run against. To index your own contracts you run a local Willow node and indexer; the dashboard talks to them.
- An **Ethereum RPC endpoint** (e.g. a free Alchemy or Infura key) for the dashboard's live `totalAssets()` / chain-tip calls. A public endpoint works but is rate-limited.

> `register-rs` depends on the Willow Rust SDK (`willow-sdk`), pulled from [`willow-network/willow-sdk-rust`](https://github.com/willow-network/willow-sdk-rust). The dashboard vendors the TypeScript SDK at `dashboard/vendor/willow-sdk/` so its build needs no extra setup.

## 1. Fork and rename

```bash
git clone <your-fork> my-dashboard && cd my-dashboard
```

Then make it yours:

- `dashboard/package.json` — change `name` and `description`.
- Replace `dashboard/public/og-card.jpg` and the title/branding in `dashboard/src/yieldnest/Layout.tsx`.

## 2. Describe what to index (the subgrove manifest)

A subgrove manifest is a JSON file under `protocol/subgroves/`. It lists the contracts to watch, their ABIs, the events to decode, and where to start. Copy `protocol/subgroves/01-vaults-eth.json` as your template and edit:

- **`data_sources`** — each entry is a contract: `address`, `abi` (e.g. `ERC4626`, `ERC20`, or a custom ABI), `start_block`, and the event signatures to decode (`Deposit`, `Withdraw`, `Transfer`, …).
- **`chain_id`** — `1` for Ethereum mainnet.
- **`execution_mode`** — `IndexerExecution` (the indexer decodes events and commits them) is the common mode and what most of these manifests use. The in-browser Merkle-proof verification works the same regardless of mode.

Keep your subgrove **IDs** consistent: the same string you give the manifest must appear in the indexer's `subgrove_filter` and in the dashboard's `config.ts`.

## 3. Configure the indexer

Edit `protocol/indexer/indexer.toml`:

- **`grovedb_path`** — keep it relative (`./grovedb`) so it resolves on any machine.
- **`subgrove_filter`** — the whitelist of subgrove IDs this indexer should pull. List exactly your subgroves.
- **`eth_rpc_endpoints`** (and any per-chain RPC map) — supply your own endpoints. The public ones are rate-limited; add an authenticated Alchemy/Infura URL for real throughput.
- **Identity** — the indexer runs as a DID (`node_did`) with a deterministic signing key. On your own network, create and fund your own indexer DID rather than reusing a demo identity.

## 4. Register the subgrove and run the indexer

Register your manifest, then start the indexer pointed at it:

```bash
# from protocol/scripts/register-rs
cargo run -- --manifest ../../subgroves/01-vaults-eth.json
```

On your own network you register and fund subgroves under an **owner DID** that you control. The demo's `bringup_demo.sh` uses the well-known devnet `validator1` seed (the public Ed25519 RFC 8032 test vector — intentionally public, pre-funded at genesis). For your own deployment, swap in your own funded owner DID; that test seed only works on a devnet genesis that pre-funds it.

Once the indexer is running it reads your contracts, decodes events into GroveDB, and serves each entity with a Merkle proof against a committed state root.

## 5. Wire up the dashboard

Edit `dashboard/src/yieldnest/config.ts`:

- **`SUBGROVES`** — map your subgrove IDs (must match the manifest and the indexer filter).
- **`VAULTS`** (or the equivalent entity list) — your contract symbols, names, addresses, and `chainId`.

Then set the runtime env. Copy `dashboard/.env.example` to `.env.local` and fill in:

| Variable | What it points at | Dev fallback |
|---|---|---|
| `VITE_WILLOW_API` | Willow validator REST (`/subgroves`) | `/willow-api` proxy → `:3031` |
| `VITE_INDEXER_GQL` | Indexer GraphQL endpoint | `/indexer-gql` proxy → `:3051` |
| `VITE_ETH_RPC` | Ethereum RPC for `totalAssets()` / tip polling | `/eth-rpc` proxy |
| `ALCHEMY_ETH_KEY` | Dev-only key for the `/eth-rpc` proxy | build/proxy-time only; not shipped to the client |

The committed `.env.production` points at **Willow's** infrastructure. Override every endpoint for your own deployment — otherwise your build silently talks to someone else's servers.

```bash
cd dashboard && npm install && npm run dev   # http://127.0.0.1:5273
```

## 6. Add the verified badge

Drop a `<ProofBadge />` next to any row to give it click-to-verify behavior. The reference implementation is `dashboard/src/yieldnest/ProofViewer.tsx`: it fetches one entity plus its Merkle proof (`runQueryWithProof`), calls `grovedb.verifyGroveDBProof()` from `@willow/sdk`, and checks that the recomputed `rootHash` equals the proof's `state_root`. That equality check, running in the browser, is the entire trust story.

**Be precise about what the badge claims.** It proves the data hashes up to the indexer's *committed state root* — that the row wasn't altered in transit or by the page. It does **not** (yet) prove that state root is anchored in Willow consensus; that's on the roadmap. Keep your own copy honest — don't advertise "verified in your browser" for anything beyond the GroveDB Merkle proof path.

## Deploy (Cloudflare Pages)

The dashboard is a static SPA — any static host works. For Cloudflare Pages:

- **Build root**: `dashboard/`
- **Build command**: `npm run build`
- **Output dir**: `dist/`
- **SPA fallback**: `public/_redirects` already contains `/* /index.html 200`.
- **Env vars**: set the three `VITE_` vars in the Pages project (don't rely on the committed `.env.production`, which targets Willow infra).

## Gotchas

- **Vendored SDK.** `@willow/sdk` is vendored at `dashboard/vendor/willow-sdk/` so the build works without a sibling `willow` checkout. Keep it vendored (or install the published SDK) — a build host won't have the core repo next to it.
- **The crypto shim.** `vite.config.ts` aliases Node's `crypto` to `dashboard/src/lib/crypto-shim.ts`, because the vendored SDK imports `createHash` for a path the browser verifier doesn't use. If you re-vendor or upgrade the SDK and hit a cryptic bundler error about `crypto`, this shim is why — keep it.
- **Keep IDs in sync.** A subgrove ID lives in three places: the manifest, the indexer `subgrove_filter`, and the dashboard `config.ts`. Drift between them is the most common "no data" cause.
