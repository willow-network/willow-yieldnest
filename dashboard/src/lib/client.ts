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
let cachedKey: string | null = null;

export function getClient(apiUrl: string, indexerUrl?: string): WillowClient {
  const key = `${apiUrl}|${indexerUrl ?? ''}`;
  if (cached && cachedKey === key) return cached;

  const client = new WillowClient({
    apiUrl,
    indexerUrl: indexerUrl || undefined,
    consensusRpcUrl: apiUrl.startsWith('/') ? '/cometbft-rpc' : undefined,
  });
  client.auth.setIdentity(
    DEVNET_VALIDATOR1.did,
    DEVNET_VALIDATOR1.privateKey,
    DEVNET_VALIDATOR1.publicKeyId,
  );

  cached = client;
  cachedKey = key;
  return client;
}

let cachedConsensus: ConsensusClient | null = null;
let cachedConsensusUrl: string | null = null;

export function getConsensusClient(apiUrl: string): ConsensusClient {
  let cometUrl: string;
  const match = apiUrl.match(/:(\d+)(\/)?$/);
  if (match) {
    const apiPort = parseInt(match[1]);
    const nodeN = apiPort - 3030;
    const rpcPort = 26557 + nodeN * 100;
    cometUrl = apiUrl.replace(`:${apiPort}`, `:${rpcPort}`);
  } else {
    cometUrl = '/cometbft-rpc';
  }

  if (cachedConsensus && cachedConsensusUrl === cometUrl) return cachedConsensus;

  cachedConsensus = new ConsensusClient({
    consensusRpcUrl: cometUrl,
    apiUrl,
    chainId: 'test-chain-consensus',
    maxRetries: 3,
    requestTimeoutSecs: 30,
    retryDelaySecs: 1,
  });
  cachedConsensusUrl = cometUrl;
  return cachedConsensus;
}

export function sign(message: string, privateKey: string): string {
  return signEd25519(message, privateKey);
}

export const DEFAULT_API_URL =
  typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? '/willow-api'
    : 'http://127.0.0.1:3031';

export const DEFAULT_INDEXER_URL = '';
