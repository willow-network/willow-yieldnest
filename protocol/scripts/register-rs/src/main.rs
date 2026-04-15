//! Registers all YieldNest subgroves against a Willow node via willow-sdk.

use anyhow::{anyhow, Context, Result};
use clap::Parser;
use ed25519_dalek::SigningKey;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use willow_sdk::auth::{generate_did, DidInfo};
use willow_sdk::consensus::ConsensusClient;
use willow_sdk::subgrove_config::{
    DataSourceDef, EventHandlerDef, IndexerConfigDef, ManifestDef, MappingDef, SourceDef,
    SubgroveDefinition,
};
use willow_sdk::types::SignatureAlgorithm;

#[derive(Parser, Debug)]
#[command(about = "Register all YieldNest subgroves")]
struct Args {
    #[arg(long)]
    node: String,
    #[arg(long, default_value = "http://localhost:3031")]
    api: String,
    #[arg(long, default_value = "~/.willow/yieldnest-demo/did.json")]
    did_file: String,
    #[arg(long)]
    owner_did: Option<String>,
    #[arg(long)]
    key_hex: Option<String>,
    #[arg(long)]
    skip_did: bool,
    #[arg(long)]
    funding: Option<u128>,
    #[arg(long)]
    root: Option<PathBuf>,
    #[arg(long)]
    dry_run: bool,
    /// Instead of registering, fund each already-registered subgrove with
    /// this many whole WILL tokens. Example: --fund-all 10000 = 10k WILL each.
    #[arg(long)]
    fund_all: Option<u128>,
}

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
#[derive(Deserialize)]
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
    let network = idx.manifest.chain_id.map(network_for).unwrap_or("multi-chain");

    for c in idx.manifest.contracts {
        let events = c.events.clone().unwrap_or_else(|| idx.manifest.events.clone());
        let abi = c.abi.clone().unwrap_or_else(|| "ERC20".into());
        data_sources.push(DataSourceDef {
            kind: "ethereum/contract".into(),
            name: c.name,
            network: network.into(),
            source: SourceDef { address: c.address, abi, start_block },
            mapping: MappingDef {
                event_handlers: events.into_iter().map(|e| EventHandlerDef {
                    event: e.clone(),
                    handler: format!("handle{e}"),
                }).collect(),
            },
        });
    }

    if data_sources.is_empty() && !idx.manifest.deployments.is_empty() {
        for (i, d) in idx.manifest.deployments.iter().enumerate() {
            data_sources.push(DataSourceDef {
                kind: "ethereum/contract".into(),
                name: format!("deployment_{i}"),
                network: d.get("name").and_then(|v| v.as_str()).unwrap_or("unknown").into(),
                source: SourceDef {
                    address: d.get("ynETHx").or_else(|| d.get("address"))
                        .and_then(|v| v.as_str()).unwrap_or("0x0").into(),
                    abi: "ERC4626".into(),
                    start_block: 0,
                },
                mapping: MappingDef {
                    event_handlers: idx.manifest.events.iter().map(|e| EventHandlerDef {
                        event: e.clone(), handler: format!("handle{e}"),
                    }).collect(),
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

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    let root = args.root.unwrap_or_else(|| {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
    });
    let subgroves_dir = root.join("subgroves");
    let schemas_dir = root.join("schemas");

    let mut entries: Vec<_> = std::fs::read_dir(&subgroves_dir)
        .with_context(|| format!("read {}", subgroves_dir.display()))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
        .collect();
    entries.sort();

    let client = ConsensusClient::new_with_api(&args.node, &args.api);

    let (owner_did, public_key_id, signing_key, did_doc_for_register): (String, String, SigningKey, Option<willow_sdk::types::DidDocument>) =
        if let (Some(did), Some(kh)) = (args.owner_did.as_ref(), args.key_hex.as_ref()) {
            let sk = load_signing_key(kh)?;
            let kid = format!("{}#key-1", did);
            (did.clone(), kid, sk, None)
        } else {
            let did_path = expand(&args.did_file);
            let stored = load_or_create_did(&did_path)
                .with_context(|| format!("load/create DID at {}", did_path.display()))?;
            let sk = load_signing_key(&stored.private_key_hex)?;
            (stored.did, stored.public_key_id, sk, Some(stored.did_document))
        };

    if let Some(will_whole) = args.fund_all {
        let amount = will_whole.saturating_mul(1_000_000_000_000_000_000);
        println!("YieldNest subgrove funding");
        println!("  node:   {}", args.node);
        println!("  api:    {}", args.api);
        println!("  from:   {}", owner_did);
        println!("  amount: {will_whole} WILL per subgrove ({amount} base units)");
        println!("  files:  {}", entries.len());
        println!();

        for path in entries {
            let raw = std::fs::read_to_string(&path)?;
            let mf: ManifestFile = serde_json::from_str(&raw)
                .with_context(|| format!("parse {}", path.display()))?;
            let sg_id = mf.subgrove_id;
            if args.dry_run {
                println!("[dry-run] would fund {sg_id} with {will_whole} WILL");
                continue;
            }
            println!("→ funding {sg_id} ...");
            let req = willow_sdk::types::FundSubgroveRequest {
                subgrove_id: sg_id.clone(),
                amount,
                from_did: owner_did.clone(),
                signature: Vec::new(),
                public_key_id: public_key_id.clone(),
                nonce: 0,
            };
            match client.fund_subgrove(req, &signing_key).await {
                Ok(tx) => {
                    println!("  tx: {tx}");
                    // Wait for commit so the next tx fetches a fresh nonce.
                    let _ = client.wait_for_transaction(&tx, 10).await;
                }
                Err(e) => return Err(anyhow!("fund {sg_id} failed: {e}")),
            }
        }
        println!("\nDone.");
        return Ok(());
    }

    println!("YieldNest subgrove registration");
    println!("  node:  {}", args.node);
    println!("  api:   {}", args.api);
    println!("  did:   {}", owner_did);
    println!("  files: {}", entries.len());
    println!();

    if !args.skip_did && !args.dry_run {
        if let Some(did_document) = did_doc_for_register.as_ref() {
            println!("→ registering DID (idempotent)");
            let pk_hex = hex::encode(signing_key.to_bytes());
            match client.register_did(did_document, &pk_hex, &public_key_id, SignatureAlgorithm::Ed25519).await {
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
        } else {
            println!("→ skipping DID registration (using pre-existing DID)\n");
        }
    }

    for path in entries {
        let raw = std::fs::read_to_string(&path)?;
        let mf: ManifestFile = serde_json::from_str(&raw)
            .with_context(|| format!("parse {}", path.display()))?;
        let schema_path = schemas_dir.join(schema_file_for(&mf.subgrove_id));
        let schema_src = std::fs::read_to_string(&schema_path)
            .with_context(|| format!("read schema {}", schema_path.display()))?;
        let sg_id = mf.subgrove_id.clone();
        let def = to_definition(mf, schema_src)?;

        if args.dry_run {
            println!("[dry-run] would register {sg_id} ({} data sources)", def.manifest.data_sources.len());
            continue;
        }

        println!("→ registering {sg_id} ...");
        let tx = client
            .register_blockchain_subgrove(&def, &owner_did, &public_key_id, &signing_key, args.funding)
            .await
            .with_context(|| format!("register {sg_id}"))?;
        println!("  tx: {tx}");
        // Wait for commit so the next tx fetches a fresh nonce.
        let _ = client.wait_for_transaction(&tx, 10).await;
    }

    println!("\nDone.");
    Ok(())
}
