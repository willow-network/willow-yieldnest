import { WillowClient, ConsensusClient, signEd25519 } from '@willow/sdk';

// did:willow:validator1 credentials.
//
// This is the RFC 8032 Section 7.1 "Test 1" Ed25519 test vector — a publicly
// known keypair also used by the Rust SDK's devnet helpers at
// sdk/willow-rust/src/lib.rs:166. In every Willow devnet genesis, this DID is
// pre-registered and funded with ~200k WILL tokens, so it can sign writes
// (register subgroves, store data) without any bootstrap dance.
//
// NEVER use this keypair in production. It's intentionally public.
export const DEVNET_VALIDATOR1 = {
  did: 'did:willow:validator1',
  privateKey: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  publicKey: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  publicKeyId: 'did:willow:validator1#key-1',
} as const;

let cached: WillowClient | null = null;
let cachedApiUrl: string | null = null;

export function getClient(apiUrl: string): WillowClient {
  if (cached && cachedApiUrl === apiUrl) return cached;

  const client = new WillowClient({ apiUrl });
  client.auth.setIdentity(
    DEVNET_VALIDATOR1.did,
    DEVNET_VALIDATOR1.privateKey,
    DEVNET_VALIDATOR1.publicKeyId,
  );

  cached = client;
  cachedApiUrl = apiUrl;
  return client;
}

let cachedConsensus: ConsensusClient | null = null;
let cachedConsensusUrl: string | null = null;

/**
 * Get a ConsensusClient for broadcasting transactions to CometBFT.
 * Derives the CometBFT RPC URL from the API URL (e.g., :3031 → :26657).
 * If the API URL is a proxy path (like /willow-api), defaults to localhost:26657.
 */
export function getConsensusClient(apiUrl: string): ConsensusClient {
  let cometUrl: string;
  const match = apiUrl.match(/:(\d+)(\/)?$/);
  if (match) {
    const apiPort = parseInt(match[1]);
    const nodeN = apiPort - 3030;
    const rpcPort = 26557 + nodeN * 100;
    cometUrl = apiUrl.replace(`:${apiPort}`, `:${rpcPort}`);
  } else {
    // Proxy mode or unknown — default to local node 1 CometBFT
    cometUrl = 'http://127.0.0.1:26657';
  }

  if (cachedConsensus && cachedConsensusUrl === cometUrl) return cachedConsensus;

  cachedConsensus = new ConsensusClient({
    consensusRpcUrl: cometUrl,
    apiUrl,
    chainId: 'test-chain-consensus',
  });
  cachedConsensusUrl = cometUrl;
  return cachedConsensus;
}

export function sign(message: string, privateKey: string): string {
  return signEd25519(message, privateKey);
}

// In dev mode, Vite proxies /willow-api/* → http://127.0.0.1:3031/* so we
// avoid CORS. For production, set the full URL of the Willow API node.
export const DEFAULT_API_URL =
  typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? '/willow-api'
    : 'http://127.0.0.1:3031';
