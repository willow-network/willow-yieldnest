#!/usr/bin/env bash
# End-to-end demo bringup for YieldNest.
set -euo pipefail

YN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# The core willow repo is expected as a sibling clone of willow-yieldnest.
# Path: willow-yieldnest/protocol/scripts/bringup_demo.sh → ../../../willow
if [[ ! -d "$YN_ROOT/../../willow" ]]; then
  echo "error: core willow repo not found at $(cd "$YN_ROOT/../.." && pwd)/willow" >&2
  echo >&2
  echo "This script boots a local Willow devnet, which needs the core willow repo" >&2
  echo "(not yet public) cloned as a sibling of willow-yieldnest." >&2
  echo "To see this stack running against the hosted network instead, visit" >&2
  echo "https://yieldnest.willow.tech or run the dashboard locally against the" >&2
  echo "hosted endpoints — see protocol/README.md." >&2
  exit 1
fi
WILLOW_ROOT="$(cd "$YN_ROOT/../../willow" && pwd)"
NODE_URL="http://localhost:26657"
API_URL="http://localhost:3031"

echo "=== YieldNest demo bringup ==="
echo "willow root:  $WILLOW_ROOT"
echo "partner root: $YN_ROOT"
echo "node:         $NODE_URL"
echo "api:          $API_URL"
echo

cd "$WILLOW_ROOT"

echo "→ cleanup any prior run"
./scripts/cleanup.sh >/dev/null 2>&1 || true

if [[ ! -d devnet/node1/.cometbft ]]; then
  echo "→ setup_network.sh (first time)"
  ./scripts/setup_network.sh
else
  echo "→ devnet already initialized"
fi

echo "→ starting network (background)"
./scripts/start_network.sh &
NET_PID=$!
trap "echo 'stopping network ($NET_PID)'; kill $NET_PID 2>/dev/null || true; ./scripts/cleanup.sh >/dev/null 2>&1 || true" EXIT

echo -n "→ waiting for RPC+API+consensus-ready "
READY=0
# pipefail off inside loop — curl can fail while devnet boots
set +e
for i in $(seq 1 120); do
  if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    status=$(curl -sf "$NODE_URL/status" 2>/dev/null || echo "")
    catching=$(echo "$status" | sed -n 's/.*"catching_up":\([^,}]*\).*/\1/p' | head -1)
    height=$(echo "$status"   | sed -n 's/.*"latest_block_height":"\([0-9]*\)".*/\1/p' | head -1)
    if [[ "$catching" == "false" && -n "$height" && "$height" -gt 1 ]]; then
      echo " up (height=$height)"
      READY=1
      break
    fi
  fi
  echo -n "."
  sleep 2
done
set -e
[[ $READY -eq 1 ]] || { echo "network never became ready"; exit 1; }

echo "→ registering subgroves as did:willow:validator1 (pre-funded genesis DID)"
cd "$YN_ROOT/scripts/register-rs"
# --key-hex below is the public RFC 8032 §7.1 test vector (the well-known devnet
# validator1 seed, pre-funded at genesis). Devnet only — never use on a real network.
cargo run --release --quiet -- \
  --node "$NODE_URL" \
  --api  "$API_URL" \
  --owner-did "did:willow:validator1" \
  --key-hex "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60" \
  --skip-did

echo
echo "=== Ready ==="
echo "Node RPC:  $NODE_URL"
echo "API:       $API_URL"
echo
echo "Network still running (PID $NET_PID). Ctrl-C to stop."
wait $NET_PID
