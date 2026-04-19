//! Registers all YieldNest subgroves against a Willow node via willow-sdk.
//!
//! Subcommands:
//!
//! - `register` — register every manifest under `protocol/subgroves/*.json`
//! - `fund`     — fund every registered subgrove with N whole WILL each
//! - `reset`    — deregister one or all subgroves (funding refunds to owner)
//! - `inspect`  — pretty-print on-chain info for a subgrove
//! - `diff`     — show how a local manifest differs from the on-chain info
//!
//! `reset`, `inspect`, and `diff` exist because `RegisterSubgrove` is
//! idempotent: re-submitting a manifest with a new `start_block` is a
//! no-op. To actually change indexing config you have to `reset` and then
//! `register`, which is exactly the flow these subcommands support. The
//! server side bumps `deployment_epoch` on every dereg so indexers notice
//! the change and restart their pipelines (see
//! `crates/indexer-node/src/lib.rs::restart_changed_subgroves`).

use anyhow::{anyhow, Context, Result};
use clap::{Parser, Subcommand};
use ed25519_dalek::SigningKey;
use serde::Deserialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use willow_sdk::auth::{generate_did, DidInfo};
use willow_sdk::consensus::ConsensusClient;
use willow_sdk::subgrove_config::{
    DataSourceDef, EventHandlerDef, IndexerConfigDef, ManifestDef, MappingDef, SourceDef,
    SubgroveDefinition,
};
use willow_sdk::types::SignatureAlgorithm;

#[derive(Parser, Debug)]
#[command(about = "YieldNest subgrove management CLI")]
struct Args {
    /// Tendermint RPC endpoint (e.g. http://localhost:26657).
    #[arg(long, global = true)]
    node: Option<String>,
    /// Willow REST API endpoint used for nonce lookups and queries.
    #[arg(long, global = true, default_value = "http://localhost:3031")]
    api: String,
    /// Path to a JSON file storing the owner DID + ed25519 key. Created on
    /// first run unless --owner-did / --key-hex are passed.
    #[arg(
        long,
        global = true,
        default_value = "~/.willow/yieldnest-demo/did.json"
    )]
    did_file: String,
    /// Owner DID (takes precedence over --did-file).
    #[arg(long, global = true)]
    owner_did: Option<String>,
    /// Hex-encoded 32-byte ed25519 private key paired with --owner-did.
    #[arg(long, global = true)]
    key_hex: Option<String>,
    /// Skip the upfront DID registration step (handy for repeat runs).
    #[arg(long, global = true)]
    skip_did: bool,
    /// Root of the `protocol/` tree (defaults to sibling of register-rs).
    #[arg(long, global = true)]
    root: Option<PathBuf>,
    /// Print what would happen without sending any transactions.
    #[arg(long, global = true)]
    dry_run: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Register every subgrove manifest under `protocol/subgroves/`.
    Register {
        /// Initial funding per subgrove (in base units). Skipped if unset.
        #[arg(long)]
        funding: Option<u128>,
    },
    /// Fund every registered subgrove with this many whole WILL tokens.
    Fund {
        /// WILL per subgrove (e.g. `10000` = 10k WILL each).
        #[arg(long)]
        will_per_subgrove: u128,
    },
    /// Deregister one or all subgroves. Remaining funding is refunded to
    /// the owner DID. The server bumps `deployment_epoch` so that the next
    /// register will actually take effect in indexers.
    Reset {
        /// Specific subgrove_id to deregister. If omitted, all manifests
        /// in `protocol/subgroves/` are deregistered in sequence.
        #[arg(long)]
        subgrove: Option<String>,
    },
    /// Pretty-print the on-chain state of a subgrove.
    Inspect {
        /// subgrove_id to look up.
        subgrove: String,
    },
    /// Report fields where a local manifest disagrees with on-chain state.
    ///
    /// Useful before re-registering: shows what would actually change. If
    /// nothing would change, the re-register is a no-op — either no reset
    /// needed, or the manifest hasn't been edited yet.
    Diff {
        /// Specific subgrove_id. If omitted, every local manifest is
        /// compared against its on-chain counterpart.
        #[arg(long)]
        subgrove: Option<String>,
    },
}

// ===========================================================================
// Manifest loading (shared between register/reset/diff)
// ===========================================================================

#[derive(Deserialize)]
struct ManifestFile {
    subgrove_id: String,
    description: String,
    mode: Mode,
}
#[derive(Deserialize)]
struct Mode {
    #[serde(rename = "BlockchainIndexing")]
    indexing: Indexing,
}
#[derive(Deserialize)]
struct Indexing {
    execution_mode: String,
    indexer_config: IndexerCfg,
    manifest: ManifestBody,
}
#[derive(Deserialize)]
struct IndexerCfg {
    min_indexers: u8,
    #[serde(default)]
    reward_rate_per_block: Option<String>,
}
#[derive(Deserialize)]
struct ManifestBody {
    #[serde(default)]
    chain_id: Option<u64>,
    #[serde(default)]
    start_block: Option<u64>,
    #[serde(default)]
    contracts: Vec<ContractEntry>,
    #[serde(default)]
    deployments: Vec<serde_json::Value>,
    #[serde(default)]
    events: Vec<String>,
}
#[derive(Deserialize, Clone)]
struct ContractEntry {
    name: String,
    address: String,
    #[serde(default)]
    abi: Option<String>,
    #[serde(default)]
    events: Option<Vec<String>>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct StoredDid {
    did: String,
    public_key_id: String,
    private_key_hex: String,
    public_key_hex: String,
    did_document: willow_sdk::types::DidDocument,
}

fn expand(p: &str) -> PathBuf {
    if let Some(rest) = p.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(p)
}

fn load_or_create_did(did_file: &Path) -> Result<StoredDid> {
    if did_file.exists() {
        let raw = std::fs::read_to_string(did_file)?;
        return Ok(serde_json::from_str(&raw)?);
    }
    let info: DidInfo = generate_did(SignatureAlgorithm::Ed25519)?;
    let stored = StoredDid {
        did: info.did.clone(),
        public_key_id: info.public_key_id.clone(),
        private_key_hex: hex::encode(&info.private_key),
        public_key_hex: hex::encode(&info.public_key),
        did_document: info.did_document,
    };
    if let Some(parent) = did_file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(did_file, serde_json::to_string_pretty(&stored)?)?;
    Ok(stored)
}

fn network_for(chain_id: u64) -> &'static str {
    match chain_id {
        1 => "mainnet",
        10 => "optimism",
        56 => "bnb",
        137 => "polygon",
        8453 => "base",
        42161 => "arbitrum-one",
        _ => "unknown",
    }
}

fn schema_file_for(subgrove_id: &str) -> &'static str {
    match subgrove_id {
        s if s.starts_with("yieldnest-vaults-") => "vault_events.graphql",
        "yieldnest-restaking-eth" => "restaking_events.graphql",
        "yieldnest-liquidity" => "liquidity_events.graphql",
        "yieldnest-governance" => "governance_events.graphql",
        _ => "vault_events.graphql",
    }
}

fn to_definition(m: ManifestFile, schema_src: String) -> Result<SubgroveDefinition> {
    let idx = m.mode.indexing;
    let reward_per_epoch = idx
        .indexer_config
        .reward_rate_per_block
        .as_deref()
        .map(|s| s.parse::<u128>())
        .transpose()
        .context("reward_rate_per_block parse")?
        .unwrap_or(100_000_000_000_000_000);

    let mut data_sources = Vec::new();
    let start_block = idx.manifest.start_block.unwrap_or(0);
    let network = idx
        .manifest
        .chain_id
        .map(network_for)
        .unwrap_or("multi-chain");

    for c in idx.manifest.contracts {
        let events = c
            .events
            .clone()
            .unwrap_or_else(|| idx.manifest.events.clone());
        let abi = c.abi.clone().unwrap_or_else(|| "ERC20".into());
        data_sources.push(DataSourceDef {
            kind: "ethereum/contract".into(),
            name: c.name,
            network: network.into(),
            source: SourceDef {
                address: c.address,
                abi,
                start_block,
            },
            mapping: MappingDef {
                event_handlers: events
                    .into_iter()
                    .map(|e| EventHandlerDef {
                        event: e.clone(),
                        handler: format!("handle{e}"),
                    })
                    .collect(),
            },
        });
    }

    if data_sources.is_empty() && !idx.manifest.deployments.is_empty() {
        for (i, d) in idx.manifest.deployments.iter().enumerate() {
            data_sources.push(DataSourceDef {
                kind: "ethereum/contract".into(),
                name: format!("deployment_{i}"),
                network: d
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .into(),
                source: SourceDef {
                    address: d
                        .get("ynETHx")
                        .or_else(|| d.get("address"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("0x0")
                        .into(),
                    abi: "ERC4626".into(),
                    start_block: 0,
                },
                mapping: MappingDef {
                    event_handlers: idx
                        .manifest
                        .events
                        .iter()
                        .map(|e| EventHandlerDef {
                            event: e.clone(),
                            handler: format!("handle{e}"),
                        })
                        .collect(),
                },
            });
        }
    }

    Ok(SubgroveDefinition {
        subgrove_id: m.subgrove_id,
        description: m.description,
        execution_mode: idx.execution_mode,
        sampling_rate_percent: None,
        required_tee: None,
        indexer_config: IndexerConfigDef {
            min_indexers: idx.indexer_config.min_indexers,
            max_indexers: (idx.indexer_config.min_indexers + 2).max(3),
            reward_per_epoch,
            min_indexer_stake: 100_000_000_000_000_000_000_000,
        },
        schema: schema_src,
        manifest: ManifestDef {
            spec_version: "0.1.0".into(),
            description: "YieldNest dashboard indexing".into(),
            data_sources,
        },
    })
}

fn load_signing_key(hex_str: &str) -> Result<SigningKey> {
    let bytes = hex::decode(hex_str.trim()).context("key_hex decode")?;
    if bytes.len() != 32 {
        return Err(anyhow!("expected 32-byte ed25519 key, got {}", bytes.len()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(SigningKey::from_bytes(&arr))
}

/// Enumerate `protocol/subgroves/*.json` in sorted order.
fn manifest_paths(root: &Path) -> Result<Vec<PathBuf>> {
    let subgroves_dir = root.join("subgroves");
    let mut entries: Vec<_> = std::fs::read_dir(&subgroves_dir)
        .with_context(|| format!("read {}", subgroves_dir.display()))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
        .collect();
    entries.sort();
    Ok(entries)
}

// ===========================================================================
// Direct tendermint RPC helpers for inspect / diff
// ===========================================================================

/// Run an ABCI query against the validator and return the decoded bytes.
///
/// `path` is a tendermint store path like `/store/subgrove/{id}`. Returns
/// `Ok(None)` when the path returns an error code or empty value (treat as
/// "not found"), `Err` only on transport / JSON-shape failures.
async fn abci_query(http: &reqwest::Client, node_url: &str, path: &str) -> Result<Option<Vec<u8>>> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "abci_query",
        "params": { "path": path, "data": "", "prove": false },
    });
    let resp = http
        .post(node_url)
        .json(&body)
        .send()
        .await
        .with_context(|| format!("POST {node_url}"))?;
    let v: Value = resp
        .json()
        .await
        .context("parse abci_query JSON response")?;
    let response = v
        .pointer("/result/response")
        .ok_or_else(|| anyhow!("missing result.response in RPC reply: {v}"))?;
    let code = response.get("code").and_then(|c| c.as_u64()).unwrap_or(0);
    let value_b64 = response.get("value").and_then(|s| s.as_str()).unwrap_or("");
    if code != 0 || value_b64.is_empty() {
        return Ok(None);
    }
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(value_b64)
        .context("decode ABCI value as base64")?;
    Ok(Some(bytes))
}

async fn fetch_subgrove_info(
    http: &reqwest::Client,
    node_url: &str,
    subgrove_id: &str,
) -> Result<Option<Value>> {
    let bytes = abci_query(http, node_url, &format!("/store/subgrove/{subgrove_id}")).await?;
    match bytes {
        Some(b) => Ok(Some(
            serde_json::from_slice(&b).context("parse subgrove info JSON")?,
        )),
        None => Ok(None),
    }
}

async fn fetch_subgrove_funding(
    http: &reqwest::Client,
    node_url: &str,
    subgrove_id: &str,
) -> Result<Option<Value>> {
    let bytes = abci_query(
        http,
        node_url,
        &format!("/store/subgrove_funding/{subgrove_id}"),
    )
    .await?;
    match bytes {
        Some(b) => Ok(Some(
            serde_json::from_slice(&b).context("parse subgrove_funding JSON")?,
        )),
        None => Ok(None),
    }
}

// ===========================================================================
// Identity bootstrap (shared across subcommands that need to sign)
// ===========================================================================

struct IdentityContext {
    owner_did: String,
    public_key_id: String,
    signing_key: SigningKey,
    did_doc_for_register: Option<willow_sdk::types::DidDocument>,
}

fn load_identity(args: &Args) -> Result<IdentityContext> {
    if let (Some(did), Some(kh)) = (args.owner_did.as_ref(), args.key_hex.as_ref()) {
        let sk = load_signing_key(kh)?;
        let kid = format!("{}#key-1", did);
        Ok(IdentityContext {
            owner_did: did.clone(),
            public_key_id: kid,
            signing_key: sk,
            did_doc_for_register: None,
        })
    } else {
        let did_path = expand(&args.did_file);
        let stored = load_or_create_did(&did_path)
            .with_context(|| format!("load/create DID at {}", did_path.display()))?;
        let sk = load_signing_key(&stored.private_key_hex)?;
        Ok(IdentityContext {
            owner_did: stored.did,
            public_key_id: stored.public_key_id,
            signing_key: sk,
            did_doc_for_register: Some(stored.did_document),
        })
    }
}

async fn ensure_did_registered(
    client: &ConsensusClient,
    ident: &IdentityContext,
    dry_run: bool,
    skip: bool,
) -> Result<()> {
    if skip || dry_run {
        return Ok(());
    }
    let Some(did_document) = ident.did_doc_for_register.as_ref() else {
        println!("→ skipping DID registration (using pre-existing DID)\n");
        return Ok(());
    };
    println!("→ registering DID (idempotent)");
    let pk_hex = hex::encode(ident.signing_key.to_bytes());
    match client
        .register_did(
            did_document,
            &pk_hex,
            &ident.public_key_id,
            SignatureAlgorithm::Ed25519,
        )
        .await
    {
        Ok(tx) => println!("   tx: {tx}"),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("already") || msg.contains("exists") {
                println!("   already registered, continuing");
            } else {
                return Err(anyhow!("register_did failed: {msg}"));
            }
        }
    }
    println!();
    Ok(())
}

fn resolve_root(args: &Args) -> PathBuf {
    args.root
        .clone()
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join(".."))
}

fn require_node(args: &Args) -> Result<String> {
    args.node
        .clone()
        .ok_or_else(|| anyhow!("--node is required"))
}

// ===========================================================================
// Subcommand handlers
// ===========================================================================

async fn cmd_register(args: &Args, funding: Option<u128>) -> Result<()> {
    let node = require_node(args)?;
    let root = resolve_root(args);
    let schemas_dir = root.join("schemas");
    let entries = manifest_paths(&root)?;

    let client = ConsensusClient::new_with_api(&node, &args.api);
    let ident = load_identity(args)?;

    println!("YieldNest subgrove registration");
    println!("  node:  {}", node);
    println!("  api:   {}", args.api);
    println!("  did:   {}", ident.owner_did);
    println!("  files: {}\n", entries.len());

    ensure_did_registered(&client, &ident, args.dry_run, args.skip_did).await?;

    for path in entries {
        let raw = std::fs::read_to_string(&path)?;
        let mf: ManifestFile =
            serde_json::from_str(&raw).with_context(|| format!("parse {}", path.display()))?;
        let schema_path = schemas_dir.join(schema_file_for(&mf.subgrove_id));
        let schema_src = std::fs::read_to_string(&schema_path)
            .with_context(|| format!("read schema {}", schema_path.display()))?;
        let sg_id = mf.subgrove_id.clone();
        let def = to_definition(mf, schema_src)?;

        if args.dry_run {
            println!(
                "[dry-run] would register {sg_id} ({} data sources)",
                def.manifest.data_sources.len()
            );
            continue;
        }

        println!("→ registering {sg_id} ...");
        let tx = client
            .register_blockchain_subgrove(
                &def,
                &ident.owner_did,
                &ident.public_key_id,
                &ident.signing_key,
                funding,
            )
            .await
            .with_context(|| format!("register {sg_id}"))?;
        println!("  tx: {tx}");
        let _ = client.wait_for_transaction(&tx, 10).await;
    }
    println!("\nDone.");
    Ok(())
}

async fn cmd_fund(args: &Args, will_per_subgrove: u128) -> Result<()> {
    let node = require_node(args)?;
    let root = resolve_root(args);
    let entries = manifest_paths(&root)?;

    let client = ConsensusClient::new_with_api(&node, &args.api);
    let ident = load_identity(args)?;
    let amount = will_per_subgrove.saturating_mul(1_000_000_000_000_000_000);

    println!("YieldNest subgrove funding");
    println!("  node:   {}", node);
    println!("  api:    {}", args.api);
    println!("  from:   {}", ident.owner_did);
    println!("  amount: {will_per_subgrove} WILL per subgrove ({amount} base units)");
    println!("  files:  {}\n", entries.len());

    for path in entries {
        let raw = std::fs::read_to_string(&path)?;
        let mf: ManifestFile =
            serde_json::from_str(&raw).with_context(|| format!("parse {}", path.display()))?;
        let sg_id = mf.subgrove_id;
        if args.dry_run {
            println!("[dry-run] would fund {sg_id} with {will_per_subgrove} WILL");
            continue;
        }
        println!("→ funding {sg_id} ...");
        let req = willow_sdk::types::FundSubgroveRequest {
            subgrove_id: sg_id.clone(),
            amount,
            from_did: ident.owner_did.clone(),
            signature: Vec::new(),
            public_key_id: ident.public_key_id.clone(),
            nonce: 0,
        };
        match client.fund_subgrove(req, &ident.signing_key).await {
            Ok(tx) => {
                println!("  tx: {tx}");
                let _ = client.wait_for_transaction(&tx, 10).await;
            }
            Err(e) => return Err(anyhow!("fund {sg_id} failed: {e}")),
        }
    }
    println!("\nDone.");
    Ok(())
}

async fn cmd_reset(args: &Args, subgrove: Option<String>) -> Result<()> {
    let node = require_node(args)?;
    let root = resolve_root(args);

    let client = ConsensusClient::new_with_api(&node, &args.api);
    let ident = load_identity(args)?;

    // Collect the list of subgrove_ids to deregister. Either the single one
    // from --subgrove, or everything under `protocol/subgroves/`.
    let targets: Vec<String> = match subgrove {
        Some(id) => vec![id],
        None => {
            let entries = manifest_paths(&root)?;
            let mut ids = Vec::with_capacity(entries.len());
            for path in entries {
                let raw = std::fs::read_to_string(&path)?;
                let mf: ManifestFile = serde_json::from_str(&raw)
                    .with_context(|| format!("parse {}", path.display()))?;
                ids.push(mf.subgrove_id);
            }
            ids
        }
    };

    println!("YieldNest subgrove reset");
    println!("  node:    {}", node);
    println!("  from:    {}", ident.owner_did);
    println!("  targets: {}\n", targets.len());

    for sg_id in targets {
        if args.dry_run {
            println!("[dry-run] would deregister {sg_id}");
            continue;
        }
        println!("→ deregistering {sg_id} ...");
        let req = willow_sdk::types::DeregisterSubgroveRequest {
            subgrove_id: sg_id.clone(),
            owner_did: ident.owner_did.clone(),
            signature: Vec::new(),
            public_key_id: ident.public_key_id.clone(),
            nonce: 0,
        };
        match client.deregister_subgrove(req, &ident.signing_key).await {
            Ok(tx) => {
                println!("  tx: {tx}");
                // Block until commit so the next reset reads a fresh nonce.
                let _ = client.wait_for_transaction(&tx, 10).await;
            }
            Err(e) => return Err(anyhow!("deregister {sg_id} failed: {e}")),
        }
    }
    println!("\nDone. Re-run `register` to redeploy with a fresh deployment_epoch.");
    Ok(())
}

async fn cmd_inspect(args: &Args, subgrove_id: String) -> Result<()> {
    let node = require_node(args)?;
    let http = reqwest::Client::new();

    let info = fetch_subgrove_info(&http, &node, &subgrove_id)
        .await?
        .ok_or_else(|| anyhow!("Subgrove not found: {subgrove_id}"))?;
    let funding = fetch_subgrove_funding(&http, &node, &subgrove_id).await?;

    println!("Subgrove: {subgrove_id}\n");

    let get_str = |key: &str| -> &str { info.get(key).and_then(|v| v.as_str()).unwrap_or("—") };
    let get_u64 = |key: &str| -> u64 { info.get(key).and_then(|v| v.as_u64()).unwrap_or(0) };

    println!("  owner_did:         {}", get_str("owner_did"));
    println!("  description:       {}", get_str("description"));
    println!("  deployment_block:  {}", get_u64("deployment_block"));
    println!("  deployment_epoch:  {}", get_u64("deployment_epoch"));
    println!(
        "  source_start_block:{}",
        info.get("source_start_block")
            .and_then(|v| v.as_u64())
            .map(|n| n.to_string())
            .unwrap_or_else(|| "(none)".into()),
    );
    println!(
        "  execution_mode:    {}",
        info.get("execution_mode")
            .map(|v| v.to_string())
            .unwrap_or_else(|| "—".into())
    );
    println!(
        "  contracts:         [{}]",
        info.get("contract_addresses")
            .and_then(|v| v.as_array())
            .map(|arr| arr
                .iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(", "))
            .unwrap_or_default(),
    );
    let active_indexers = info
        .get("active_indexers")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
        .unwrap_or_default();
    println!(
        "  active_indexers:   {}",
        if active_indexers.is_empty() {
            "(none)".into()
        } else {
            active_indexers.join(", ")
        }
    );
    if let Some(schema) = info.get("schema").and_then(|v| v.as_str()) {
        let lines = schema.lines().count();
        println!("  schema:            {lines} lines, {} chars", schema.len());
    }
    match funding {
        Some(f) => {
            let balance = f.get("balance").and_then(|v| v.as_u64()).unwrap_or(0);
            println!("  funding balance:   {balance} base units");
        }
        None => println!("  funding balance:   (no funding record)"),
    }
    if let Some(net) = info
        .pointer("/manifest_json/data_sources/0/network")
        .and_then(|v| v.as_str())
    {
        println!("  network (manifest):{net}");
    }
    Ok(())
}

/// Boiled-down view of a local manifest for diffing against the chain.
///
/// Only fields that actually get baked into the on-chain
/// `SubgroveIndexingInfo` matter here — everything the server recomputes
/// (`deployment_block`, `active_indexers`, …) is deliberately omitted so
/// we don't flag expected drift.
struct LocalManifestView {
    subgrove_id: String,
    start_block: u64,
    network: String,
    contracts: Vec<String>,
    schema_lines: usize,
    execution_mode: String,
}

fn build_local_view(path: &Path, schemas_dir: &Path) -> Result<LocalManifestView> {
    let raw = std::fs::read_to_string(path)?;
    let mf: ManifestFile =
        serde_json::from_str(&raw).with_context(|| format!("parse {}", path.display()))?;
    let schema_path = schemas_dir.join(schema_file_for(&mf.subgrove_id));
    let schema_src = std::fs::read_to_string(&schema_path)
        .with_context(|| format!("read schema {}", schema_path.display()))?;
    let idx = &mf.mode.indexing;
    let network = idx
        .manifest
        .chain_id
        .map(network_for)
        .unwrap_or("multi-chain")
        .to_string();
    let start_block = idx.manifest.start_block.unwrap_or(0);
    let contracts: Vec<String> = idx
        .manifest
        .contracts
        .iter()
        .map(|c| c.address.clone())
        .collect();
    Ok(LocalManifestView {
        subgrove_id: mf.subgrove_id,
        start_block,
        network,
        contracts,
        schema_lines: schema_src.lines().count(),
        execution_mode: idx.execution_mode.clone(),
    })
}

fn print_diff_line<T: PartialEq + std::fmt::Display>(label: &str, local: &T, remote: &T) -> bool {
    if local == remote {
        false
    } else {
        println!("  {label}:");
        println!("    local:  {local}");
        println!("    remote: {remote}");
        true
    }
}

async fn diff_one(http: &reqwest::Client, node: &str, local: &LocalManifestView) -> Result<()> {
    let info = match fetch_subgrove_info(http, node, &local.subgrove_id).await? {
        Some(i) => i,
        None => {
            println!(
                "[{}] NOT FOUND on-chain — would be a fresh registration",
                local.subgrove_id
            );
            return Ok(());
        }
    };

    let remote_start = info
        .get("source_start_block")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let remote_network = info
        .pointer("/manifest_json/data_sources/0/network")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let remote_contracts: Vec<String> = info
        .get("contract_addresses")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_ascii_lowercase()))
                .collect()
        })
        .unwrap_or_default();
    let local_contracts: Vec<String> = local
        .contracts
        .iter()
        .map(|s| s.to_ascii_lowercase())
        .collect();
    let remote_schema_lines = info
        .get("schema")
        .and_then(|v| v.as_str())
        .map(|s| s.lines().count())
        .unwrap_or(0);
    let remote_execution_mode = info
        .get("execution_mode")
        .map(|v| {
            v.as_str()
                .map(|s| s.to_string())
                .unwrap_or_else(|| v.to_string())
        })
        .unwrap_or_default();

    println!("[{}]", local.subgrove_id);
    let mut any = false;
    any |= print_diff_line("start_block", &local.start_block, &remote_start);
    any |= print_diff_line("network", &local.network, &remote_network);
    any |= print_diff_line(
        "execution_mode",
        &local.execution_mode,
        &remote_execution_mode,
    );
    any |= print_diff_line("schema_lines", &local.schema_lines, &remote_schema_lines);

    let mut local_sorted = local_contracts.clone();
    local_sorted.sort();
    let mut remote_sorted = remote_contracts.clone();
    remote_sorted.sort();
    if local_sorted != remote_sorted {
        any = true;
        println!("  contracts:");
        println!("    local:  [{}]", local_sorted.join(", "));
        println!("    remote: [{}]", remote_sorted.join(", "));
    }
    if !any {
        println!("  (no relevant differences — re-register would be a no-op)");
    }
    Ok(())
}

async fn cmd_diff(args: &Args, subgrove: Option<String>) -> Result<()> {
    let node = require_node(args)?;
    let root = resolve_root(args);
    let schemas_dir = root.join("schemas");
    let entries = manifest_paths(&root)?;
    let http = reqwest::Client::new();

    let views: Vec<LocalManifestView> = entries
        .iter()
        .filter_map(|p| build_local_view(p, &schemas_dir).ok())
        .filter(|v| match &subgrove {
            Some(id) => &v.subgrove_id == id,
            None => true,
        })
        .collect();

    if views.is_empty() {
        if let Some(id) = subgrove {
            return Err(anyhow!("No local manifest matches subgrove '{id}'"));
        } else {
            return Err(anyhow!("No manifests under protocol/subgroves/"));
        }
    }

    for v in views {
        diff_one(&http, &node, &v).await?;
        println!();
    }
    Ok(())
}

// ===========================================================================
// Entrypoint
// ===========================================================================

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    match &args.command {
        Command::Register { funding } => cmd_register(&args, *funding).await,
        Command::Fund { will_per_subgrove } => cmd_fund(&args, *will_per_subgrove).await,
        Command::Reset { subgrove } => cmd_reset(&args, subgrove.clone()).await,
        Command::Inspect { subgrove } => cmd_inspect(&args, subgrove.clone()).await,
        Command::Diff { subgrove } => cmd_diff(&args, subgrove.clone()).await,
    }
}
