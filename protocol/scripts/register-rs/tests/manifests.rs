//! Regression test: every yieldnest subgrove manifest in
//! `protocol/subgroves/*.json` must deserialize as the canonical
//! `WillowManifest` defined by `willow-types`. The consensus validator
//! rejects anything that doesn't, so any drift here is a deploy
//! failure waiting to happen on the next devnet wipe + re-register.

use serde::Deserialize;
use std::path::PathBuf;
use willow_sdk::subgrove_config::WillowManifest;

#[derive(Deserialize)]
struct ManifestFile {
    mode: Mode,
}

#[derive(Deserialize)]
struct Mode {
    #[serde(rename = "BlockchainIndexing")]
    indexing: Indexing,
}

#[derive(Deserialize)]
struct Indexing {
    manifest: WillowManifest,
}

fn subgroves_dir() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // scripts/
    p.pop(); // protocol/
    p.push("subgroves");
    p
}

#[test]
fn every_manifest_round_trips() {
    let dir = subgroves_dir();
    let mut paths: Vec<PathBuf> = std::fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|e| e == "json"))
        .collect();
    paths.sort();
    assert!(!paths.is_empty(), "no manifests found in {}", dir.display());

    for path in paths {
        let raw = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let _: ManifestFile = serde_json::from_str(&raw).unwrap_or_else(|e| {
            panic!(
                "{} did not parse as canonical WillowManifest: {e}",
                path.display()
            )
        });
    }
}
