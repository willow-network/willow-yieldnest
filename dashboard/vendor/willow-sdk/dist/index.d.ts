import { AxiosInstance } from 'axios';
import { AddressLike, BytesLike } from 'ethers';

/**
 * Proof verification for Willow query results.
 *
 * Delegates to the pure-TypeScript GroveDB verifier in src/grovedb/. Every
 * exported function performs full cryptographic verification — no heuristics.
 * The returned root hash must be compared against a trusted source (e.g. a
 * light client's verified block header) to establish data authenticity.
 */

interface ProofVerificationOptions {
    /**
     * Optional expected root hash (hex). When set, `verifyQueryProof` and
     * `verifyItemProof` will throw if the computed root does not match. For
     * trustless operation, prefer obtaining the expected root from a light
     * client rather than hardcoding it here.
     */
    expectedRootHash?: string;
    /** Reserved for server-assisted verification against `/verify-proof`. */
    serverAssisted?: boolean;
    /** API endpoint used when `serverAssisted` is enabled. */
    apiUrl?: string;
}
interface ProofVerificationResult {
    valid: boolean;
    rootHash?: string;
    error?: string;
}
declare function configureProofVerification(options: ProofVerificationOptions): void;
/**
 * Verify a query/range proof and return the computed root hash (hex).
 *
 * The caller must compare this to a trusted root hash to establish
 * authenticity — this function alone does not prove the data came from a
 * canonical state unless combined with an independent trust anchor.
 *
 * Accepts an optional `options` override; when omitted, falls back to the
 * globally configured options (see `configureProofVerification`).
 */
declare function verifyQueryProof(proofHex: string, _documents: DataRecord[], options?: ProofVerificationOptions): Promise<string>;
/**
 * Verify a single-item proof and return the computed root hash (hex).
 *
 * Beyond computing the root, this also enforces that the proof actually
 * contains the requested `key` at the given `path` — rejecting proofs that
 * are internally valid but prove a different (key, path) within the same
 * state tree.
 *
 * Accepts an optional `options` override; when omitted, falls back to the
 * globally configured options (see `configureProofVerification`).
 */
declare function verifyItemProof(proofHex: string, key: string, _value: any, path?: string[], options?: ProofVerificationOptions): Promise<string>;
/**
 * Stateful GroveDB proof verifier that binds `ProofVerificationOptions` at
 * construction time. Mirrors the Python SDK's `GroveDBProofVerifier` so
 * React/JS callers that want instance-scoped options (rather than global
 * configuration) have a cross-language-consistent API.
 *
 * For the simpler throwing API, use the module functions directly
 * (`verifyQueryProof`, `verifyItemProof`, `extractRootHashFromProof`).
 */
declare class GroveDBProofVerifier {
    readonly options: ProofVerificationOptions;
    constructor(options?: ProofVerificationOptions);
    /**
     * Verify a query/range proof. Returns a `ProofVerificationResult` instead
     * of throwing, matching the Python SDK's behaviour.
     */
    verifyQueryProof(proofHex: string, documents: DataRecord[]): Promise<ProofVerificationResult>;
    /**
     * Verify a single-item proof. Returns a `ProofVerificationResult` instead
     * of throwing. On success, `rootHash` is the computed root; on failure,
     * `error` carries the reason (missing key, root mismatch, etc.).
     */
    verifyItemProof(proofHex: string, key: string, value: any, path?: string[]): Promise<ProofVerificationResult>;
    /**
     * Extract the root hash from a proof via full verification. Throws if
     * the proof is malformed — use `verifyQueryProof` for a non-throwing
     * variant that returns a structured result.
     */
    extractRootHash(proofHex: string): Promise<string>;
}
/**
 * Fully verify a proof and return the root hash. Despite the name, this
 * performs the same cryptographic checks as `verifyQueryProof` — it does
 * not skip verification.
 */
declare function extractRootHashFromProof(proofHex: string): Promise<string>;
declare function verifyQueryResponse(response: QueryResponse): Promise<string>;
/**
 * Advanced verification that returns a detailed result instead of throwing.
 */
declare function verifyProofAdvanced(proofHex: string, _documents: DataRecord[], options?: ProofVerificationOptions): Promise<ProofVerificationResult>;

interface WillowConfig {
    apiUrl: string;
    /**
     * Optional explicit indexer node URL. When set, `source: 'indexer'` and
     * `source: 'auto'` queries route directly to this URL and skip the
     * `GET /indexers` discovery round-trip. When unset (the common case), the
     * SDK discovers indexers automatically via the validator's registry.
     *
     * Use cases for the override:
     * - Local dev: avoid a tiny extra RTT on every query.
     * - Pinning: always hit the operator's own indexer (enterprise, paid).
     * - Debugging: isolate which indexer is serving a request.
     */
    indexerUrl?: string;
    /** Optional CometBFT RPC URL for consensus transactions. Derived from apiUrl if omitted. */
    consensusRpcUrl?: string;
    did?: string;
    privateKey?: string;
    proofVerificationOptions?: ProofVerificationOptions;
}
/**
 * Which backend should serve a query.
 *
 * - `'validator'`: consensus-verified chain-tip. Every row comes with
 *   Merkle proofs. Fails fast for `VerifyOnly` subgroves (validator
 *   never stored the data).
 * - `'indexer'`: full history + analytics. Trust is sampling/dispute based.
 *   Fails if no indexer serves the subgrove or all reachable ones fail.
 * - `'auto'` (default): indexer if any serves this subgrove, otherwise
 *   validator. On indexer failure, falls back to validator and flags
 *   the result with `fallback: true`.
 */
type QuerySource = "validator" | "indexer" | "auto";
interface GraphQLQueryOptions {
    source?: QuerySource;
    variables?: Record<string, any>;
    operationName?: string;
}
interface SqlQueryOptions {
    source?: QuerySource;
    includeProof?: boolean;
}
/** Result envelope surfacing which backend actually served a query. */
interface RoutedQueryResult<T> {
    /** Raw response body from the backend. */
    result: T;
    /** Backend that served this query. */
    source: "validator" | "indexer";
    /** DID of the indexer that served (only present when `source === 'indexer'`). */
    indexerDid?: string;
    /** True when `'auto'` routing fell back from indexer → validator. */
    fallback: boolean;
}
type GraphQLQueryResult = RoutedQueryResult<any>;
type SqlQueryResult = RoutedQueryResult<SqlQueryResponse>;
interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}
interface PublicKey {
    id: string;
    type: string;
    publicKeyHex?: string;
    publicKeyBase64?: string;
}
interface DidDocument {
    id: string;
    publicKeys: PublicKey[];
    created: number;
    updated: number;
}
interface FieldType {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'bytes';
    indexed?: boolean;
    required?: boolean;
}
interface IndexDefinition {
    name: string;
    fields: string[];
    unique: boolean;
    type?: 'unique' | 'hash' | 'range' | 'fulltext' | 'compound';
}
interface SchemaDefinition {
    version: number;
    fields: Record<string, FieldType>;
    indexes?: IndexDefinition[];
    required_fields?: string[];
}
interface RegisterDatasetRequest {
    dataset_id: string;
    name: string;
    dataset_path: string[];
    schema: SchemaDefinition;
    owner_did: string;
    writers: string[];
    readers: string[];
}
interface DatasetRegistration {
    dataset_id: string;
    name: string;
    schema: SchemaDefinition;
    owner_did: string;
    writers: string[];
    readers: string[];
    created_at: number;
    updated_at: number;
}
interface DataRecord {
    [key: string]: any;
}
interface ProofResponse {
    proof: string;
    height?: number;
}
interface QueryFilter {
    [field: string]: any | {
        $eq?: any;
        $ne?: any;
        $gt?: any;
        $gte?: any;
        $lt?: any;
        $lte?: any;
        $in?: any[];
        $contains?: string;
    };
}
interface QuerySort {
    field: string;
    order: 'asc' | 'desc';
}
interface QuerySearch {
    field: string;
    query: string;
}
interface QueryRequest {
    filters?: QueryFilter;
    search?: QuerySearch;
    sort?: QuerySort;
    limit?: number;
    offset?: number;
    include_proof?: boolean;
}
interface QueryResponse {
    documents: DataRecord[];
    total?: number;
    offset?: number;
    limit?: number;
    proof?: string;
    verifiedRootHash?: string;
}
interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    genesis_supply: string;
    minted_supply: string;
    max_supply: string;
    circulating_supply: string;
}
interface Balance {
    did: string;
    available: string;
    staked: string;
    locked: string;
}
interface TransferRequest {
    from_did: string;
    to_did: string;
    amount: string;
    memo?: string;
}
interface HistoricalQueryRequest {
    /** GroveDB path to query */
    path: number[][];
    /** Key to query (for single-key queries) */
    key?: number[];
    /** Query type: "get", "get_range", "get_path" */
    query_type?: string;
    /** Whether to include proof */
    include_proof?: boolean;
}
interface HistoricalQueryResponse {
    /** Whether the query was successful */
    success: boolean;
    /** Provider DID that served this query */
    provider_did?: string;
    /** Provider endpoint */
    provider_endpoint?: string;
    /** Checkpoint state root for proof verification */
    state_root: string;
    /** Block range covered by the checkpoint */
    block_range: [number, number];
    /** Query results from the indexer */
    data: any;
    /** Merkle proof (hex-encoded) when include_proof was true */
    proof?: string;
    /** Whether this data can be re-indexed (only set on error) */
    can_reindex?: boolean;
    /** Error message if any */
    error?: string;
}
interface CheckpointInfo {
    /** Checkpoint ID (hex) */
    checkpoint_id: string;
    /** Subgrove ID */
    subgrove_id: string;
    /** State root hash (hex) */
    state_root: string;
    /** Block range [start, end] */
    block_range: [number, number];
    /** DID of the indexer who submitted this checkpoint */
    indexer_did: string;
    /** Unix timestamp when the checkpoint was submitted */
    submitted_at: number;
    /** Whether the checkpoint is trusted */
    is_trusted: boolean;
}
interface SqlQueryRequest {
    query: string;
    include_proof?: boolean;
}
interface SqlQueryResponse {
    columns: string[];
    rows: any[][];
    total?: number;
    warnings?: string[];
    proof?: QueryProof;
}
interface QueryProof {
    merkle_proofs: MerkleProof[];
    state_root: number[];
    block_height: number;
    ethereum_anchor?: EthereumAnchor;
}
interface MerkleProof {
    key: string;
    value_hash: number[];
    siblings: number[][];
    path: string;
}
interface EthereumAnchor {
    block_number: number;
    tx_hash: number[];
    contract: string;
}
declare class WillowError extends Error {
    code?: string | undefined;
    statusCode?: number | undefined;
    constructor(message: string, code?: string | undefined, statusCode?: number | undefined);
}

/**
 * Supported signature algorithms
 */
type SignatureAlgorithm = 'Ed25519' | 'secp256k1';
/**
 * Detect signature algorithm from DID or key format
 */
declare function detectAlgorithm(did: string, privateKey?: string): SignatureAlgorithm;
/**
 * Sign a message with Ed25519
 */
declare function signEd25519(message: string, privateKeyHex: string): string;
/**
 * Verify an Ed25519 signature
 */
declare function verifyEd25519(message: string, signatureHex: string, publicKeyHex: string): boolean;
/**
 * Generate a new Ed25519 key pair
 */
declare function generateEd25519KeyPair(): {
    privateKey: string;
    publicKey: string;
};
/**
 * Get public key from Ed25519 private key
 */
declare function getEd25519PublicKey(privateKeyHex: string): string;
/**
 * Per-request signature headers
 */
interface SignedRequestHeaders {
    [key: string]: string;
    'X-DID': string;
    'X-Public-Key-ID': string;
    'X-Signature': string;
    'X-Timestamp': string;
}
declare class WillowAuth {
    private api;
    private did?;
    private privateKey?;
    private publicKeyId?;
    private algorithm?;
    constructor(apiUrl: string);
    /**
     * Set identity for per-request signing.
     * Call this once; all subsequent requests will be signed automatically.
     */
    setIdentity(did: string, privateKey: string, publicKeyId: string): void;
    /**
     * Check if an identity is configured for signing
     */
    hasIdentity(): boolean;
    /**
     * Get the current DID
     */
    getDid(): string | undefined;
    /**
     * Get the current private key (hex-encoded)
     */
    getPrivateKey(): string | undefined;
    /**
     * Get the current public key ID
     */
    getPublicKeyId(): string | undefined;
    /**
     * Register a new DID document
     */
    registerDid(didDocument: DidDocument): Promise<DidDocument>;
    /**
     * Get DID document
     */
    getDid_(did: string): Promise<DidDocument>;
    /**
     * Sign a request and return the authentication headers.
     *
     * Message format: `{METHOD}:{PATH}:{TIMESTAMP}`
     */
    signRequest(method: string, path: string): SignedRequestHeaders;
    /**
     * Get authentication headers for an API request.
     * Returns signature headers if identity is set, empty object otherwise.
     */
    getAuthHeaders(method: string, path: string): Record<string, string>;
    /**
     * Get query parameters for authentication (DID only, for pay-per-read fallback)
     */
    getAuthParams(): Record<string, string>;
}

/**
 * Computed Fields Module
 *
 * This module provides SDK-layer computation of derived fields from proven data.
 * It enables drop-in compatibility with The Graph's query interfaces by computing
 * derived values (like price ratios) from cryptographically proven base data.
 *
 * Design Philosophy:
 * - GKR circuits prove the underlying data (reserves, volumes, balances)
 * - Division and other derived calculations are done client-side
 * - Same trust model: proven inputs + deterministic computation = trustworthy outputs
 * - Same API: queries return the same fields The Graph would return
 *
 * @example
 * ```typescript
 * // Register Uniswap V2 computed fields
 * client.registerComputedFields('pairs', UNISWAP_V2_PAIR_FIELDS);
 *
 * // Query returns computed prices alongside proven reserves
 * const pair = await client.query('pairs', { filters: { id: '0x...' } });
 * // pair.documents[0] contains:
 * // - reserve0, reserve1 (proven by GKR circuit)
 * // - token0Price, token1Price (computed from proven reserves)
 * ```
 */

/**
 * A function that computes a derived value from a record's proven fields.
 * Returns undefined if the computation cannot be performed (e.g., division by zero).
 */
type ComputeFunction = (record: DataRecord) => number | string | undefined;
/**
 * Definition of a single computed field.
 */
interface ComputedFieldDefinition {
    /** The field name in the output record */
    name: string;
    /** Human-readable description of what this field represents */
    description: string;
    /** The proven fields this computation depends on */
    dependencies: string[];
    /** The computation function */
    compute: ComputeFunction;
}
/**
 * A set of computed field definitions for a dataset.
 */
type ComputedFieldSet = ComputedFieldDefinition[];
/**
 * Registry of computed fields by dataset (subgrove).
 */
declare class ComputedFieldRegistry {
    private registry;
    /**
     * Register computed fields for a specific dataset (subgrove).
     *
     * @param datasetId - The dataset (subgrove) ID
     * @param fields - The computed field definitions
     */
    register(datasetId: string, fields: ComputedFieldSet): void;
    /**
     * Get computed fields for a specific dataset.
     */
    get(datasetId: string): ComputedFieldSet | undefined;
    /**
     * Check if computed fields are registered for a dataset.
     */
    has(datasetId: string): boolean;
    /**
     * Remove computed fields for a dataset.
     */
    unregister(datasetId: string): boolean;
    /**
     * Clear all registered computed fields.
     */
    clear(): void;
}
/**
 * Apply computed fields to a single record.
 *
 * @param record - The data record with proven fields
 * @param fields - The computed field definitions to apply
 * @returns A new record with computed fields added
 */
declare function applyComputedFields(record: DataRecord, fields: ComputedFieldSet): DataRecord;
/**
 * Apply computed fields to a query response.
 * Modifies documents in place for efficiency.
 *
 * @param response - The query response with proven data
 * @param fields - The computed field definitions to apply
 * @returns The response with computed fields added to documents
 */
declare function applyComputedFieldsToResponse(response: QueryResponse, fields: ComputedFieldSet): QueryResponse;
/**
 * Uniswap V2 Pair computed fields.
 *
 * These fields are computed from proven reserve data to match
 * The Graph's Uniswap V2 subgraph schema.
 *
 * Proven fields required:
 * - reserve0: Token 0 reserve amount
 * - reserve1: Token 1 reserve amount
 * - token0.decimals: Token 0 decimals (optional, defaults to 18)
 * - token1.decimals: Token 1 decimals (optional, defaults to 18)
 */
declare const UNISWAP_V2_PAIR_FIELDS: ComputedFieldSet;
/**
 * Uniswap V2 Token computed fields.
 *
 * These fields compute derived ETH prices from proven stablecoin pool reserves.
 *
 * Proven fields required:
 * - For WETH: Just use 1.0 as derivedETH (detected by isWeth or symbol)
 * - For tokens: ethPairReserve0, ethPairReserve1 (reserves from WETH pair)
 */
declare const UNISWAP_V2_TOKEN_FIELDS: ComputedFieldSet;
/**
 * Uniswap V2 daily/hourly data computed fields.
 *
 * These compute USD values from proven ETH amounts and ETH price.
 */
declare const UNISWAP_V2_AGGREGATION_FIELDS: ComputedFieldSet;
/**
 * Generic AMM pair fields (works for Uniswap V2, Sushiswap, etc.).
 *
 * A simplified version of pair fields without decimal adjustment.
 */
declare const GENERIC_AMM_PAIR_FIELDS: ComputedFieldSet;
/**
 * Lending protocol fields (for Aave, Compound, etc.).
 *
 * Computes utilization rate from proven supply and borrow amounts.
 */
declare const LENDING_PROTOCOL_FIELDS: ComputedFieldSet;
/**
 * LP share computation fields.
 */
declare const LP_SHARE_FIELDS: ComputedFieldSet;
declare const globalComputedFieldRegistry: ComputedFieldRegistry;

/**
 * Matches `ApiIndexerInfo` on the server side.
 * See `crates/indexing/src/indexing_service.rs`.
 */
interface ApiIndexerInfo {
    indexer_did: string;
    subgroves: string[];
    stake_amount: number;
    /** Monitoring / health endpoint. */
    endpoint: string;
    /** Preferred query endpoint. When absent, callers fall back to `endpoint`. */
    query_endpoint?: string;
    status: string;
    performance_score: number;
    last_update: number;
}
/** Returns the URL a client should POST GraphQL / SQL queries to. */
declare function effectiveQueryEndpoint(info: ApiIndexerInfo): string;
interface WillowIndexersOptions {
    /**
     * When set, skip discovery and return this URL for every query. Useful for
     * pinning a specific indexer (local dev, testing, enterprise deployments).
     */
    indexerUrl?: string;
    /** Cache TTL override (milliseconds). Default: 30 000. */
    cacheTtlMs?: number;
}
/**
 * Client for the validator's indexer-discovery endpoint.
 *
 * Usage:
 * ```ts
 * const indexers = new WillowIndexers("http://validator:3031");
 * const servers = await indexers.forSubgrove("my-subgrove");
 * // servers is sorted by performance_score desc
 * ```
 */
declare class WillowIndexers {
    private api;
    private apiUrl;
    private indexerUrl?;
    private cacheTtlMs;
    private cache?;
    private inflight?;
    constructor(apiUrl: string, options?: WillowIndexersOptions);
    /**
     * Whether the SDK was configured with an explicit indexer URL. When true,
     * `list`/`forSubgrove` return a synthetic single-entry list and never hit
     * the validator's `/indexers` endpoint.
     */
    hasExplicitOverride(): boolean;
    /** Force the next lookup to re-fetch from `/indexers`. */
    invalidate(): void;
    /**
     * Return all registered indexers, cached for `cacheTtlMs`.
     */
    list(): Promise<ApiIndexerInfo[]>;
    /**
     * Return active indexers that serve `subgroveId`, sorted by
     * `performance_score` descending (best candidate first).
     *
     * When an explicit `indexerUrl` override is set, always returns a single
     * synthetic entry — the caller doesn't need to special-case this.
     */
    forSubgrove(subgroveId: string): Promise<ApiIndexerInfo[]>;
    /**
     * Evict an indexer from the cache (e.g., after a 5xx response). Next
     * lookup will re-fetch from the validator.
     */
    evict(indexerDid: string): void;
    private syntheticEntry;
}

declare class ValidatorHasNoDataError extends WillowError {
    constructor(subgroveId: string, reason: string);
}
declare class NoIndexersReachableError extends WillowError {
    constructor(subgroveId: string, details: string);
}
declare class WillowData {
    private api;
    private auth;
    private apiUrl;
    private cometbftRpcUrl?;
    private lightClient?;
    private lightClientInitPromise?;
    private computedFieldRegistry;
    private indexers;
    constructor(apiUrl: string, auth: WillowAuth, indexers: WillowIndexers, cometbftRpcUrl?: string);
    /**
     * Register computed fields for a specific dataset.
     *
     * Computed fields are derived client-side from proven data. This enables
     * drop-in compatibility with The Graph's query interfaces by computing
     * values like price ratios from cryptographically proven reserves.
     *
     * @param datasetId - The dataset ID
     * @param fields - The computed field definitions
     *
     * @example
     * ```typescript
     * import { UNISWAP_V2_PAIR_FIELDS } from '@willow/sdk';
     *
     * client.data.registerComputedFields('pairs', UNISWAP_V2_PAIR_FIELDS);
     * ```
     */
    registerComputedFields(datasetId: string, fields: ComputedFieldSet): void;
    /**
     * Get the computed field registry for direct manipulation.
     */
    getComputedFieldRegistry(): ComputedFieldRegistry;
    /**
     * Get or create a light client for trustless verification.
     *
     * This auto-initializes a light client using trust-on-first-use:
     * the first block received from validators is trusted, and all subsequent
     * blocks are verified against it.
     *
     * @important TODO: When mainnet/testnet launches, replace trust-on-first-use
     * with hardcoded checkpoint headers for true trustless initialization.
     * Trust-on-first-use is secure for subsequent operations but trusts the
     * initial block from the connected validators.
     */
    private getOrCreateLightClient;
    /**
     * Register a dataset/subgrove
     */
    registerDataset(request: RegisterDatasetRequest): Promise<DatasetRegistration>;
    /**
     * Store data (batch operation)
     */
    storeData(datasetId: string, data: Record<string, any>): Promise<void>;
    /**
     * Get data by key with automatic proof verification (secure by default)
     */
    getData(datasetId: string, key: string): Promise<DataRecord>;
    /**
     * Get data by key without proof verification (use with caution)
     */
    getDataUnverified(datasetId: string, key: string): Promise<DataRecord>;
    /**
     * Update data by key
     */
    updateData(datasetId: string, key: string, data: any): Promise<void>;
    /**
     * Delete data by key
     */
    deleteData(datasetId: string, key: string): Promise<void>;
    /**
     * Get cryptographic proof for data
     */
    getProof(datasetId: string, key: string): Promise<string>;
    /**
     * Batch operations helper
     */
    batchStore(datasetId: string, records: Array<{
        key: string;
        value: any;
    }>): Promise<void>;
    /**
     * Query helper - get multiple records with verification
     */
    getMultiple(datasetId: string, keys: string[]): Promise<Record<string, DataRecord>>;
    /**
     * Query helper - get multiple records without verification
     */
    getMultipleUnverified(datasetId: string, keys: string[]): Promise<Record<string, DataRecord>>;
    /**
     * Get the verified root hash using the light client.
     *
     * This uses trustless verification through the light client instead of
     * asking the node for the root hash.
     *
     * @important TODO: When mainnet/testnet launches, the light client will be
     * initialized with hardcoded checkpoint headers instead of trust-on-first-use.
     *
     * @private
     */
    private getVerifiedRootHash;
    /**
     * Query indexed data with automatic proof verification (secure by default)
     */
    query(datasetId: string, query: QueryRequest): Promise<QueryResponse>;
    /**
     * Query indexed data without proof verification (use with caution)
     */
    queryUnverified(datasetId: string, query: QueryRequest): Promise<QueryResponse>;
    /**
     * Get checkpoint state root for proof verification.
     *
     * @param subgroveId - The subgrove ID
     * @param checkpointId - The checkpoint ID (hex string)
     * @returns Checkpoint info including state root
     */
    getCheckpointStateRoot(subgroveId: string, checkpointId: string): Promise<CheckpointInfo>;
    /**
     * Query historical indexed data from a verified checkpoint.
     *
     * This method queries historical data from indexer nodes that have preserved
     * checkpoint data. The response includes proof information that can be
     * verified against the checkpoint's state root.
     *
     * @param subgroveId - The subgrove ID
     * @param checkpointId - The checkpoint ID (hex string)
     * @param query - The query parameters
     * @returns Historical query response with provider info and verification data
     *
     * @example
     * ```typescript
     * // Query historical data
     * const response = await client.data.queryHistorical(
     *   'my-subgrove',
     *   '0abc...', // checkpoint ID
     *   {
     *     path: [[97, 112, 112], [100, 97, 116, 97]], // UTF-8 bytes for path segments
     *     key: [107, 101, 121], // UTF-8 bytes for key
     *     include_proof: true
     *   }
     * );
     *
     * // Verify the response
     * if (response.success) {
     *   // Use response.state_root to verify the proof client-side
     *   console.log('Provider:', response.provider_did);
     *   console.log('State root:', response.state_root);
     * } else if (response.can_reindex) {
     *   console.log('Data unavailable, can request re-indexing');
     * }
     * ```
     */
    queryHistorical(subgroveId: string, checkpointId: string, query: HistoricalQueryRequest): Promise<HistoricalQueryResponse>;
    /**
     * Query historical data and verify the proof against checkpoint state root.
     *
     * This is the fully secure method for historical queries. It:
     * 1. Gets the checkpoint state root from consensus
     * 2. Executes the query through an indexer
     * 3. Verifies the returned proof against the checkpoint state root
     *
     * @param subgroveId - The subgrove ID
     * @param checkpointId - The checkpoint ID (hex string)
     * @param query - The query parameters (include_proof is forced to true)
     * @returns Verified historical data
     *
     * @throws {WillowError} If proof verification fails
     */
    queryHistoricalVerified(subgroveId: string, checkpointId: string, query: HistoricalQueryRequest): Promise<HistoricalQueryResponse>;
    /**
     * Execute a SQL query against a subgrove with optional Merkle proof.
     *
     * Routes to the validator (chain-tip) or an indexer (full history) based
     * on `options.source`. Defaults to `'auto'`: prefers an indexer when one
     * serves this subgrove, falling back to the validator's chain-tip data.
     *
     * @param subgroveId - Subgrove ID to query
     * @param sql - SQL SELECT query string
     * @param options - Query options including source selection
     * @returns SQL query response plus routing metadata (`source`, `fallback`)
     */
    sqlQuery(subgroveId: string, sql: string, options?: SqlQueryOptions): Promise<SqlQueryResult>;
    /**
     * Execute a GraphQL query against a subgrove.
     *
     * Routes to the validator (chain-tip, consensus-verified) or an indexer
     * (full history, analytics-friendly) based on `options.source`. Defaults
     * to `'auto'`.
     *
     * @param subgroveId - Subgrove ID to query
     * @param query - GraphQL query string
     * @param options - Query options including source selection and variables
     * @returns GraphQL response plus routing metadata (`source`, `fallback`)
     */
    graphqlQuery(subgroveId: string, query: string, options?: GraphQLQueryOptions): Promise<GraphQLQueryResult>;
    /**
     * Shared routing helper for `/graphql/:subgrove` and `/sql/:subgrove`.
     *
     * Behaviour by source:
     * - `'validator'`: POST to `{apiUrl}/{path}/:sg`; surface errors as-is.
     *   When the validator has no data (VerifyOnly subgrove, pruned retention),
     *   throws `ValidatorHasNoDataError` instead of silently falling back.
     * - `'indexer'`: walk the discovery-cached indexer list (or a synthetic
     *   single-entry list when `indexerUrl` was configured), try each in
     *   performance order, and throw `NoIndexersReachableError` if all fail.
     * - `'auto'` (default): try an indexer first if any serves the subgrove;
     *   fall back to the validator on any indexer failure, annotating the
     *   result with `fallback: true`.
     */
    private routeQuery;
}
/**
 * Extension methods for QueryResponse
 */
interface QueryResponseExt extends QueryResponse {
    verifyProof(): Promise<string>;
}
/**
 * Add verification method to QueryResponse
 */
declare function extendQueryResponse(response: QueryResponse): QueryResponseExt;

/**
 * File storage operations for Willow.
 *
 * Upload, download, and manage files in FileStorage subgroves.
 * Files are chunked locally, manifests go through consensus,
 * and chunks are uploaded to storage nodes.
 *
 * This module is browser-safe: it uses `Uint8Array` instead of Node's
 * `Buffer`, `@noble/hashes` for SHA-256, and `@noble/ciphers` for
 * XChaCha20-Poly1305.
 */
interface FileManifest {
    file_key: string;
    filename: string;
    content_type: string;
    total_size: number;
    content_hash: string;
    chunk_count: number;
    chunk_size: number;
    chunk_merkle_root: string;
    owner_did: string;
    created_at: number;
    updated_at: number;
    encrypted: boolean;
    storage_nodes: string[];
}
interface FileListResponse {
    files: FileManifest[];
}
/** Signing options for file transactions that require consensus broadcast. */
interface FileSigningOptions {
    ownerDid: string;
    privateKey: string;
    publicKeyId: string;
    signFunction: (message: string, privateKey: string) => string;
    nonce: number;
}
declare class FileOperations {
    private apiUrl;
    private getHeaders;
    constructor(apiUrl: string, getHeaders: () => Record<string, string>);
    /**
     * Upload a file to a FileStorage subgrove.
     *
     * @param signing - When provided, the manifest transaction is properly signed.
     *   Without signing options, the transaction is broadcast unsigned (requires
     *   server-side signing or a permissive test environment).
     */
    upload(subgroveId: string, fileKey: string, filename: string, data: Uint8Array, storageNodeEndpoint: string, signing?: FileSigningOptions): Promise<FileManifest>;
    /**
     * Download a file from a FileStorage subgrove.
     */
    download(subgroveId: string, fileKey: string, storageNodeEndpoint: string): Promise<Uint8Array>;
    /**
     * Get file manifest metadata.
     */
    metadata(subgroveId: string, fileKey: string): Promise<FileManifest>;
    /**
     * List all files in a subgrove.
     */
    list(subgroveId: string): Promise<FileManifest[]>;
    /**
     * Delete a file (submits DeleteFileManifestTx to consensus).
     */
    delete(subgroveId: string, fileKey: string, signing?: FileSigningOptions): Promise<void>;
    /**
     * Unregister a storage node (submits UnregisterStorageNode to consensus).
     */
    unregisterStorageNode(nodeDid: string, signing?: FileSigningOptions): Promise<void>;
}
/**
 * Encryption metadata for private file subgroves.
 */
interface FileEncryption {
    key_epoch: number;
    nonce: string;
}
/**
 * Encrypt file data using XChaCha20-Poly1305.
 *
 * Uses XChaCha20-Poly1305 with a 24-byte nonce to match the Rust SDK and
 * consensus layer. Files encrypted with this function are interoperable
 * across all Willow SDKs.
 *
 * @param data - Plaintext file data
 * @param key - 32-byte symmetric key from the subgrove key grant system
 * @returns Object with ciphertext and 24-byte nonce
 */
declare function encryptFile(data: Uint8Array, key: Uint8Array): {
    ciphertext: Uint8Array;
    nonce: Uint8Array;
};
/**
 * Decrypt file data using XChaCha20-Poly1305.
 *
 * @param ciphertext - Encrypted data (ciphertext + 16-byte auth tag)
 * @param key - 32-byte symmetric key
 * @param nonce - 24-byte nonce used during encryption
 * @returns Decrypted plaintext
 */
declare function decryptFile(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array;

/**
 * Wire types for verifiable Ethereum state reads.
 *
 * Mirrors `crates/types/src/state_proof.rs`. The Rust server serializes
 * fixed-byte arrays as JSON arrays of numbers (default serde behavior),
 * so we mirror that on the wire here. Hex-string accessors are exposed
 * in `EthOperations` for ergonomics.
 */

type Bytes20 = number[];
type Bytes32 = number[];
interface MptProof {
    key: number[];
    value: number[];
    proof_nodes: number[][];
}
interface AccountState {
    nonce: number;
    balance: Bytes32;
    storage_hash: Bytes32;
    code_hash: Bytes32;
}
interface StorageSlotProof {
    slot: Bytes32;
    value: Bytes32;
    proof: MptProof;
}
interface StateProof {
    address: Bytes20;
    block_number: number;
    block_hash: Bytes32;
    state_root: Bytes32;
    account_proof: MptProof;
    account_state: AccountState;
    storage_proofs: StorageSlotProof[];
}
/**
 * Indexer's `POST /verifiable-rpc/eth/state` and `/eth/call` envelope.
 *
 * Mirrors `VerifiableRpcResponse`; for the eth/* routes only the
 * `state_proofs`, `state_root`, `block_range`, and `answer` (for
 * eth_call's ABI-encoded return data) fields are populated.
 */
interface EthVerifiableRpcResponse {
    subgrove_id: string;
    key: string;
    answer: string;
    answer_exists: boolean;
    checkpoint_id: Bytes32;
    state_root: Bytes32;
    block_range: [number, number];
    grovedb_proof: string;
    gkr_proofs: unknown[];
    completeness_proof: string | null;
    state_proofs?: StateProof[];
    served_at_unix_secs: number;
}
interface EthStateRequest {
    address: string;
    slots: string[];
    block: number;
}
interface EthCallRequestBody {
    tx: {
        from?: AddressLike;
        to: AddressLike;
        gas?: BytesLike | string | number;
        gasPrice?: BytesLike | string;
        value?: BytesLike | string;
        data?: BytesLike;
        [k: string]: unknown;
    };
    block: number;
}
/** Verification trust modes — mirrors the Rust SDK's `StateVerifyMode`. */
declare enum StateVerifyMode {
    /** Walk every MPT proof against the carried `state_root`. Default. */
    Strict = "strict",
    /** Skip the proof walks; trust the indexer's word. */
    AnchorOnly = "anchor_only",
    /** No verification. Intended for debugging. */
    Disabled = "disabled"
}
interface VerifiedStorage {
    slot: string;
    value: bigint;
}
interface VerifiedStateRead {
    address: string;
    block_number: number;
    block_hash: string;
    state_root: string;
    nonce: number;
    balance: bigint;
    storage_hash: string;
    code_hash: string;
    storage: VerifiedStorage[];
    mode: StateVerifyMode;
}
interface VerifiedCall {
    block_number: number;
    block_hash: string;
    state_root: string;
    result: string;
    access_state_reads: VerifiedStateRead[];
    mode: StateVerifyMode;
}

/**
 * Minimal Ethereum Merkle Patricia Trie inclusion verifier.
 *
 * Walks an EIP-1186-shaped proof from a known root to a key's leaf and
 * checks the recovered leaf value matches the expected RLP encoding.
 * Handles branch (17-element), leaf, and extension nodes. Does not
 * handle inline-embedded nodes (sub-32-byte nodes packed into a parent
 * slot rather than referenced by hash) — those don't occur at the
 * depths we serve from `eth_getProof` for live mainnet state.
 */
interface MptVerifyResult {
    ok: boolean;
    error?: string;
}
/**
 * Verify `expectedValue` is found at `keyHash` in the trie rooted at `root`.
 *
 * @param root - 32-byte root hash.
 * @param keyHash - 32-byte keccak256(originalKey).
 * @param expectedValue - RLP-encoded value at the leaf.
 * @param proofNodes - Ordered RLP-encoded nodes from root to leaf.
 */
declare function verifyMptProof(root: Uint8Array, keyHash: Uint8Array, expectedValue: Uint8Array, proofNodes: Uint8Array[]): MptVerifyResult;

/**
 * Client-side verification + ergonomic helpers for verifiable Ethereum
 * state reads. Counterpart to the indexer's `/verifiable-rpc/eth/state`
 * and `/verifiable-rpc/eth/call` routes.
 *
 * Three trust modes follow `StateVerifyMode`:
 *   - `Strict` (default): every account proof + every storage proof
 *     must verify against the carried `state_root`.
 *   - `AnchorOnly`: skip the MPT walks; trust the indexer's word.
 *   - `Disabled`: no verification, raw passthrough.
 */

/** SDK operations for verifiable Ethereum state reads. */
declare class EthOperations {
    private indexerBaseUrl;
    private http;
    private mode;
    constructor(indexerBaseUrl: string, http?: AxiosInstance);
    /** Set the verification mode for subsequent calls. */
    withMode(mode: StateVerifyMode): this;
    /**
     * Fetch `address`'s account state (+ optional storage slots) at
     * `blockNumber` and verify the response.
     */
    getState(address: string, slots: string[], blockNumber: number): Promise<VerifiedStateRead>;
    /**
     * Execute `tx` via the indexer's verified-REVM at `blockNumber` and
     * verify state proofs for every touched account.
     */
    getCall(tx: EthCallRequestBody["tx"], blockNumber: number): Promise<VerifiedCall>;
    /**
     * ERC-20 `balanceOf(holder)`. `balanceSlot` is the storage-mapping slot
     * index for the token (0 for OpenZeppelin-style, 9 for USDC). Always
     * check the token source if unsure.
     */
    erc20Balance(token: string, holder: string, balanceSlot: number, blockNumber: number): Promise<bigint>;
    /** ERC-20 `totalSupply()` for tokens whose `_totalSupply` lives at `slot`. */
    erc20TotalSupply(token: string, slot: number, blockNumber: number): Promise<bigint>;
    /** ERC-20 nested-mapping `allowance(holder, spender)`. */
    erc20Allowance(token: string, holder: string, spender: string, allowanceSlot: number, blockNumber: number): Promise<bigint>;
    /** ERC-721 `ownerOf(tokenId)` from the `_owners` mapping at `slot`. */
    erc721Owner(contract: string, tokenId: bigint, slot: number, blockNumber: number): Promise<string>;
    /**
     * Uniswap V2 `getReserves()` — packed in slot 8 as
     * `[blockTimestampLast (4 bytes) | reserve1 (14) | reserve0 (14)]`
     * in big-endian on-the-wire order.
     */
    uniV2Reserves(pair: string, blockNumber: number): Promise<{
        reserve0: bigint;
        reserve1: bigint;
        blockTimestampLast: number;
    }>;
}
/**
 * Walk every MPT proof inside `proof`. Throws on first mismatch.
 */
declare function verifyStateProof(proof: StateProof): void;

/**
 * Transaction status enumeration
 */
declare enum TransactionStatus {
    PENDING = "pending",
    SUCCESS = "success",
    FAILED = "failed",
    NOT_FOUND = "not_found"
}
/**
 * Configuration for consensus client
 */
interface ConsensusConfig {
    consensusRpcUrl: string;
    apiUrl?: string;
    chainId?: string;
    requestTimeoutSecs?: number;
    maxRetries?: number;
    retryDelaySecs?: number;
}
/**
 * Result of transaction broadcast
 */
interface BroadcastResult {
    success: boolean;
    txHash?: string;
    height?: number;
    errorCode?: number;
    errorMessage?: string;
    rawLog?: string;
}
/**
 * DID registration transaction
 */
interface RegisterDidTx {
    didDocument: any;
    signature: string;
    publicKeyId: string;
    nonce: number;
}
/** How long real-time indexed data is retained on consensus nodes. */
type RetentionWindow = {
    type: 'Blocks';
    value: number;
} | {
    type: 'Seconds';
    value: number;
} | {
    type: 'Indefinite';
} | {
    type: 'VerifyOnly';
};
/**
 * Subgrove mode — determines what kind of data the subgrove holds and how
 * it's ingested. Three variants match the Rust `SubgroveMode` enum. When
 * omitted, the wire defaults to DataStorage with empty values.
 */
type SubgroveMode = {
    DataStorage: {
        name: string;
        writers?: string[];
        free_readers?: string[];
        read_pricing?: any;
    };
} | {
    FileStorage: {
        name: string;
        max_file_size: number;
        replication_factor: number;
        writers?: string[];
        free_readers?: string[];
        read_pricing?: any;
        retention_period?: number;
    };
} | {
    BlockchainIndexing: {
        manifest_content?: number[];
        wasm_modules?: any[];
        execution_mode?: any;
        indexer_config?: any;
        retention_window?: RetentionWindow;
    };
};
/**
 * Subgrove registration transaction
 */
interface RegisterSubgroveTx {
    subgroveId: string;
    schema: string;
    ownerDid: string;
    mode?: SubgroveMode;
    retention_window?: RetentionWindow;
    /** Initial funding in smallest token unit. Transferred from ownerDid to the subgrove balance. */
    initialFunding?: string;
    signature?: string;
    publicKeyId?: string;
    nonce?: number;
}
/**
 * Token transfer transaction
 */
interface TransferTx {
    fromDid: string;
    toDid: string;
    amount: number;
    memo?: string;
    signature?: string;
    publicKeyId?: string;
    nonce?: number;
}
/**
 * Data storage transaction
 */
interface DataStoreTx {
    subgroveId: string;
    key: string;
    data: string;
    ownerDid: string;
    signature?: string;
    publicKeyId?: string;
    nonce?: number;
}
interface StoreFileManifestTx {
    subgroveId: string;
    fileKey: string;
    filename: string;
    contentType: string;
    totalSize: number;
    contentHash: string;
    chunkCount: number;
    chunkSize: number;
    chunkMerkleRoot: string;
    ownerDid: string;
    signature?: string;
    publicKeyId?: string;
    nonce?: number;
}
interface DeleteFileManifestTx {
    subgroveId: string;
    fileKey: string;
    ownerDid: string;
    signature?: string;
    publicKeyId?: string;
    nonce?: number;
}
/**
 * Deregister (delete) a subgrove transaction.
 * Remaining funding balance is refunded to the owner.
 */
interface DeregisterSubgroveTx {
    subgroveId: string;
    ownerDid: string;
    signature?: string;
    publicKeyId?: string;
    nonce?: number;
}
/**
 * MCP receipt-batch anchor with chain-enforced per-DID monotonicity.
 * Mirrors `willow_types::consensus::transactions::SubmitAnchorTx`.
 * `anchorHash` is the SHA-256 of the canonical anchor body (sorted-key
 * JSON of all fields except signature/publicKeyId/nonce/anchorHash);
 * `merkleRoot` is the Merkle root over `receiptHashes`. The chain
 * recomputes both and rejects on mismatch.
 */
interface SubmitAnchorTx {
    did: string;
    anchorId: string;
    sequenceRange: [number, number];
    merkleRoot: string;
    count: number;
    receiptHashes: string[];
    timestamp: string;
    previousAnchorHash: string;
    anchorHash: string;
    isGenesis: boolean;
    signature?: string;
    publicKeyId?: string;
    nonce?: number;
}
/**
 * Transaction type union
 */
type Transaction = RegisterDidTx | RegisterSubgroveTx | TransferTx | DataStoreTx | StoreFileManifestTx | DeleteFileManifestTx | DeregisterSubgroveTx | SubmitAnchorTx;

/**
 * Consensus Client Implementation
 *
 * Provides direct transaction broadcasting to CometBFT consensus layer.
 */

/**
 * CometBFT consensus client for direct transaction broadcasting
 *
 * Enables full-featured blockchain interactions without relying on data nodes.
 */
declare class ConsensusClient {
    private config;
    private nonceCache;
    constructor(config: ConsensusConfig);
    /**
     * Register a DID on the blockchain
     */
    registerDid(didDocument: any, privateKey: string, publicKeyId: string, signFunction: (message: string, privateKey: string) => string): Promise<BroadcastResult>;
    /**
     * Register a subgrove (dataset) on the blockchain
     */
    registerSubgrove(subgroveId: string, schema: string, ownerDid: string, privateKey: string, publicKeyId: string, signFunction: (message: string, privateKey: string) => string, mode?: SubgroveMode, retentionWindow?: RetentionWindow, initialFunding?: string): Promise<BroadcastResult>;
    /**
     * Transfer tokens between DIDs
     */
    transfer(fromDid: string, toDid: string, amount: number, privateKey: string, publicKeyId: string, signFunction: (message: string, privateKey: string) => string, memo?: string): Promise<BroadcastResult>;
    /**
     * Store data on the blockchain
     */
    storeData(subgroveId: string, key: string, data: any, ownerDid: string, privateKey: string, publicKeyId: string, signFunction: (message: string, privateKey: string) => string): Promise<BroadcastResult>;
    /**
     * Store a file manifest on the blockchain
     */
    storeFileManifest(subgroveId: string, fileKey: string, filename: string, contentType: string, totalSize: number, contentHash: string, chunkCount: number, chunkSize: number, chunkMerkleRoot: string, ownerDid: string, privateKey: string, publicKeyId: string, signFunction: (message: string, privateKey: string) => string): Promise<BroadcastResult>;
    /**
     * Delete a file manifest from the blockchain
     */
    deleteFileManifest(subgroveId: string, fileKey: string, ownerDid: string, privateKey: string, publicKeyId: string, signFunction: (message: string, privateKey: string) => string): Promise<BroadcastResult>;
    /**
     * Deregister (delete) a subgrove. Remaining funding is refunded to the owner.
     */
    deregisterSubgrove(subgroveId: string, ownerDid: string, privateKey: string, publicKeyId: string, signFunction: (message: string, privateKey: string) => string): Promise<BroadcastResult>;
    /**
     * Submit an MCP receipt-batch anchor. The chain enforces per-DID
     * monotonicity (genesis-once, sequence contiguity, prev_anchor_hash
     * linkage) and recomputes both `anchorHash` and `merkleRoot` from
     * the canonical body — so the values must match byte-for-byte.
     * `merkleRoot` is computed automatically if omitted; `anchorHash`
     * is always computed here.
     */
    submitAnchor(fields: {
        did: string;
        anchorId: string;
        sequenceRange: [number, number];
        receiptHashes: string[];
        timestamp: string;
        previousAnchorHash: string;
        isGenesis: boolean;
        merkleRoot?: string;
    }, privateKey: string, publicKeyId: string, signFunction: (message: string, privateKey: string) => string): Promise<BroadcastResult>;
    /**
     * Get the status of a transaction
     */
    getTransactionStatus(txHash: string): Promise<TransactionStatus>;
    /**
     * Wait for a transaction to be confirmed
     */
    waitForTransaction(txHash: string, timeoutSecs?: number, pollInterval?: number): Promise<TransactionStatus>;
    /**
     * Get the blockchain chain ID
     */
    getChainId(): Promise<string>;
    /**
     * Get the latest blockchain height
     */
    getLatestHeight(): Promise<number | undefined>;
    /**
     * Sign a transaction and broadcast it
     */
    private signAndBroadcast;
    /**
     * Broadcast a transaction to Willow consensus.
     *
     * Goes through the API server's `POST /tx/submit` endpoint: the server
     * accepts the JSON-encoded Transaction, bincode-encodes it, and forwards
     * to CometBFT's `broadcast_tx_sync`. The chain's on-the-wire format is
     * bincode (see docs/todo/proposal-bincode-wire.md) — this keeps the SDK
     * on JSON without implementing a bincode encoder per language.
     */
    private broadcastTransaction;
    /**
     * Make a JSON-RPC request to CometBFT
     */
    private rpcRequest;
    /**
     * Query a transaction by hash
     */
    private queryTransaction;
    /**
     * Get the next nonce for a DID
     *
     * Fetches the current nonce from the blockchain and returns the next value.
     * Falls back to in-memory cache if API is unavailable.
     */
    private getNextNonce;
    /**
     * Get the current nonce for an account from the blockchain
     */
    private getAccountNonce;
    /**
     * Utility: Sleep for specified milliseconds
     */
    private sleep;
}

/**
 * Consensus Client Configuration Builder
 *
 * Provides a fluent builder pattern for configuring the consensus client.
 */

/**
 * Builder for creating consensus client configurations
 */
declare class ConsensusConfigBuilder {
    private _consensusRpcUrl;
    private _apiUrl?;
    private _chainId;
    private _requestTimeoutSecs;
    private _maxRetries;
    private _retryDelaySecs;
    /**
     * Initialize builder with required consensus RPC URL
     */
    constructor(consensusRpcUrl: string);
    /**
     * Set the REST API URL for account queries (nonce, etc.)
     */
    apiUrl(apiUrl: string): ConsensusConfigBuilder;
    /**
     * Set the blockchain chain ID
     */
    chainId(chainId: string): ConsensusConfigBuilder;
    /**
     * Set request timeout in seconds
     */
    requestTimeoutSecs(seconds: number): ConsensusConfigBuilder;
    /**
     * Set maximum retry attempts
     */
    maxRetries(retries: number): ConsensusConfigBuilder;
    /**
     * Set delay between retries in seconds
     */
    retryDelaySecs(seconds: number): ConsensusConfigBuilder;
    /**
     * Build the final configuration
     */
    build(): ConsensusConfig;
}
/**
 * Convenience functions for common configurations
 */
/**
 * Create configuration for local testing
 * @param rpcPort - CometBFT RPC port (default: 26657)
 * @param apiPort - REST API port (default: 3031)
 */
declare function localConfig(rpcPort?: number, apiPort?: number): ConsensusConfigBuilder;
/**
 * Create configuration for testnet deployment
 * @param rpcUrl - CometBFT RPC URL
 * @param apiUrl - REST API URL (optional)
 */
declare function testnetConfig(rpcUrl: string, apiUrl?: string): ConsensusConfigBuilder;
/**
 * Create configuration for mainnet deployment
 * @param rpcUrl - CometBFT RPC URL
 * @param apiUrl - REST API URL (optional)
 */
declare function mainnetConfig$1(rpcUrl: string, apiUrl?: string): ConsensusConfigBuilder;

type UnsubscribeFn = () => void;
type SubscribeSource = "validator" | "indexer";
interface SubscribeOptions {
    /** Optional GraphQL variables. */
    variables?: Record<string, any>;
    /** Optional operation name. */
    operationName?: string;
    /** Called on connection-level errors (parse, transport). */
    onError?: (err: unknown) => void;
    /**
     * Called when the subscription is definitively over and will not be
     * reconnected — either because the server sent `complete`, the caller
     * unsubscribed, or reconnection gave up / was disabled. Not called on
     * transient disconnects when `reconnect: true`.
     */
    onComplete?: () => void;
    /** Arbitrary payload forwarded on `connection_init` (e.g., auth). */
    connectionPayload?: Record<string, any>;
    /**
     * Which server to open the WebSocket against.
     *
     * - `'validator'` (default): `{apiUrl}/graphql/ws`. Consensus-verified
     *   chain-tip events. Use this for real-time data on subgroves that
     *   have chain-tip retention.
     * - `'indexer'`: picks the best-performing indexer for the subgrove via
     *   discovery (or the configured `indexerUrl` override) and connects
     *   to its `/graphql/ws`. The indexer fires `IndexedDataStored` events
     *   at submission time — useful for `VerifyOnly` subgroves where the
     *   validator has no tail, or for chart UIs that want to react to the
     *   indexer's ingest pace rather than the consensus commit pace.
     */
    source?: SubscribeSource;
    /**
     * Automatically reconnect on unexpected disconnects. Defaults to
     * `true`. Set to `false` for the classic "subscription ends on
     * close" behavior.
     *
     * This is reconnect-only — messages that were in flight when the
     * socket dropped are not replayed, and the new connection may
     * redeliver events the old one already emitted. Callers that need
     * exactly-once should dedupe by a stable field (e.g., block number
     * or entity id) themselves.
     */
    reconnect?: boolean;
    /**
     * Maximum number of reconnection attempts before giving up. Defaults
     * to `Infinity` (keep trying forever). When exhausted, `onComplete`
     * fires.
     */
    maxReconnectAttempts?: number;
    /**
     * Initial reconnect delay in milliseconds. Doubles on each failure up
     * to `maxReconnectBackoffMs`. Defaults to 500.
     */
    reconnectBackoffMs?: number;
    /**
     * Maximum reconnect delay in milliseconds. Defaults to 30 000
     * (30 seconds).
     */
    maxReconnectBackoffMs?: number;
    /**
     * Called when a reconnection attempt is scheduled. `attempt` is
     * 1-indexed (first retry is `1`). Useful for surfacing "reconnecting…"
     * UI without polluting `onError`.
     */
    onReconnect?: (attempt: number, delayMs: number) => void;
}
declare class WillowSubscriptions {
    private apiUrl;
    private indexers?;
    private counter;
    constructor(apiUrl: string, indexers?: WillowIndexers);
    /**
     * Subscribe to a GraphQL subscription and receive streamed updates.
     *
     * Returns an unsubscribe function that sends `complete`, closes the
     * WebSocket, and cancels any pending reconnection. Callers should
     * invoke it on component unmount / cleanup.
     *
     * With `source: 'indexer'`, this async-resolves the best-performing
     * indexer for the subgrove via discovery (or the configured
     * `indexerUrl` override) before opening the socket. On a reconnect,
     * the SDK re-resolves — the previously-used indexer is evicted from
     * the discovery cache first so failover to a different indexer is
     * automatic.
     *
     * @param subgroveId - Subgrove ID — used for indexer selection when
     *   `source: 'indexer'`; otherwise informational.
     * @param query - GraphQL subscription document
     * @param onNext - Called with each incoming data payload
     * @param options - Optional variables, operation name, error handlers,
     *   `source` selection, and reconnection behavior
     */
    subscribe(subgroveId: string, query: string, onNext: (payload: {
        data?: any;
        errors?: any[];
    }) => void, options?: SubscribeOptions): UnsubscribeFn;
}

/**
 * Main Willow SDK client
 */
declare class WillowClient {
    private config;
    auth: WillowAuth;
    data: WillowData;
    files: FileOperations;
    consensus: ConsensusClient;
    /** Indexer discovery client (reads validator's `/indexers` with 30s cache). */
    indexers: WillowIndexers;
    /** GraphQL subscription client (WebSocket → validator `/graphql/ws`). */
    subscriptions: WillowSubscriptions;
    /** Verifiable Ethereum state-read operations (`/verifiable-rpc/eth/*`). */
    eth: EthOperations;
    constructor(config: WillowConfig);
    /**
     * Initialize the client with authentication
     */
    init(privateKey?: string, publicKeyId?: string): Promise<void>;
    /**
     * Register a new DID
     */
    registerDid(didDocument: DidDocument): Promise<DidDocument>;
    /**
     * Register a subgrove via a consensus transaction.
     */
    registerDataset(request: RegisterDatasetRequest): Promise<DatasetRegistration>;
    /**
     * Deregister a subgrove. Remaining funding is refunded to the owner.
     *
     * Re-registering with a different start_block or schema requires
     * deregistering first — RegisterSubgroveTx is idempotent on the server,
     * so a second register of the same subgrove_id is a no-op. The server
     * bumps `deployment_epoch` on deregister, which indexers watch for to
     * restart their pipelines on the next loop tick.
     */
    deregisterSubgrove(subgroveId: string): Promise<BroadcastResult>;
    /**
     * Store data via a consensus transaction.
     */
    store(datasetId: string, key: string, value: any): Promise<void>;
    /**
     * Get data with automatic proof verification (secure by default)
     */
    get(datasetId: string, key: string): Promise<DataRecord>;
    /**
     * Get data without proof verification (use with caution)
     */
    getUnverified(datasetId: string, key: string): Promise<DataRecord>;
    /**
     * Update data via a consensus transaction (same as store — idempotent upsert).
     */
    update(datasetId: string, key: string, value: any): Promise<void>;
    /**
     * Delete data by key.
     */
    delete(datasetId: string, key: string): Promise<void>;
    /**
     * Get proof
     */
    getProof(datasetId: string, key: string): Promise<string>;
    /**
     * Get the verified root hash from the blockchain consensus
     *
     * This method retrieves the root hash that has been committed to the blockchain
     * and verified by the consensus mechanism. This is the most secure way to get
     * the root hash as it ensures the state has been agreed upon by the network.
     *
     * @returns The verified root hash from the blockchain
     * @throws Error if the root hash cannot be retrieved
     */
    getRootHash(): Promise<string>;
    /**
     * Get the local root hash from the node's current state
     *
     * This method retrieves the root hash from the node's local state tree.
     * This may be more recent than the verified root hash but has not yet been
     * committed to the blockchain. Use this only when you need the absolute
     * latest state and understand the security implications.
     *
     * @returns The local root hash from the node's state
     * @throws Error if the root hash cannot be retrieved
     */
    getRootHashLocal(): Promise<string>;
    /**
     * Query indexed data with automatic proof verification (secure by default)
     */
    query(datasetId: string, query: QueryRequest): Promise<QueryResponse>;
    /**
     * Query indexed data without proof verification (use with caution)
     */
    queryUnverified(datasetId: string, query: QueryRequest): Promise<QueryResponse>;
    /**
     * Execute a SQL query against a subgrove.
     *
     * Routes to an indexer (history + analytics) or the validator (chain-tip,
     * consensus-verified) based on `options.source`. See `QuerySource` in
     * `./types` for details.
     */
    sqlQuery(subgroveId: string, sql: string, options?: SqlQueryOptions): Promise<SqlQueryResult>;
    /**
     * Execute a GraphQL query against a subgrove.
     *
     * Routes to an indexer (history + analytics) or the validator (chain-tip,
     * consensus-verified) based on `options.source`. See `QuerySource` in
     * `./types` for details.
     */
    graphqlQuery(subgroveId: string, query: string, options?: GraphQLQueryOptions): Promise<GraphQLQueryResult>;
    /**
     * Register computed fields for a specific dataset.
     *
     * Computed fields are derived client-side from proven data. This enables
     * drop-in compatibility with The Graph's query interfaces by computing
     * values like price ratios from cryptographically proven reserves.
     *
     * @param datasetId - The dataset ID
     * @param fields - The computed field definitions
     *
     * @example
     * ```typescript
     * import { WillowClient, UNISWAP_V2_PAIR_FIELDS } from '@willow/sdk';
     *
     * const client = new WillowClient({ apiUrl: 'http://localhost:3031' });
     * client.registerComputedFields('pairs', UNISWAP_V2_PAIR_FIELDS);
     *
     * // Queries now return computed prices alongside proven reserves
     * const result = await client.query('pairs', { filters: { id: '0x...' } });
     * console.log(result.documents[0].token0Price); // Computed from proven reserves
     * ```
     */
    private requireIdentity;
    registerComputedFields(datasetId: string, fields: ComputedFieldSet): void;
    /**
     * Create a helper for a specific dataset
     */
    collection(datasetId: string): {
        store: (key: string, value: any) => Promise<void>;
        get: (key: string) => Promise<DataRecord>;
        getUnverified: (key: string) => Promise<DataRecord>;
        update: (key: string, value: any) => Promise<void>;
        delete: (key: string) => Promise<void>;
        getProof: (key: string) => Promise<string>;
        batchStore: (records: Array<{
            key: string;
            value: any;
        }>) => Promise<void>;
        getMultiple: (keys: string[]) => Promise<Record<string, DataRecord>>;
        getMultipleUnverified: (keys: string[]) => Promise<Record<string, DataRecord>>;
        query: (query: any) => Promise<QueryResponse>;
        queryUnverified: (query: any) => Promise<QueryResponse>;
    };
}

/**
 * Generate a new Ethereum wallet
 */
declare function generateWallet(): {
    address: string;
    privateKey: string;
    publicKey: string;
};
/**
 * Create a DID document from an Ethereum wallet
 */
declare function createDidFromWallet(wallet: {
    address: string;
    publicKey: string;
}): DidDocument;
/**
 * Validate DID format
 */
declare function isValidDid(did: string): boolean;
/**
 * Extract public key from DID document
 */
declare function getPublicKeyFromDid(didDocument: DidDocument, keyId?: string): PublicKey | undefined;
/**
 * Generate a unique ID
 */
declare function generateId(prefix?: string): string;
/**
 * Sleep utility for testing
 */
declare function sleep(ms: number): Promise<void>;
/**
 * Chunk array for batch operations
 */
declare function chunk<T>(array: T[], size: number): T[][];
/**
 * Retry wrapper for network operations
 */
declare function retry<T>(fn: () => Promise<T>, options?: {
    attempts?: number;
    delay?: number;
    backoff?: number;
}): Promise<T>;

/**
 * GroveDB Proof Types
 *
 * Type definitions matching the Rust GroveDB proof structures.
 */
/** 32-byte cryptographic hash */
type CryptoHash = Uint8Array;
/** Hash length constant */
declare const HASH_LENGTH = 32;
/** Null hash (all zeros) */
declare const NULL_HASH: CryptoHash;
/**
 * Tree feature types for sum trees, count trees, etc.
 */
type TreeFeatureType = {
    type: 'BasicMerkNode';
} | {
    type: 'SummedMerkNode';
    sum: bigint;
} | {
    type: 'BigSummedMerkNode';
    sum: bigint;
} | {
    type: 'CountedMerkNode';
    count: bigint;
} | {
    type: 'CountedSummedMerkNode';
    count: bigint;
    sum: bigint;
};
/**
 * Merk proof node types
 */
type MerkNode = {
    type: 'Hash';
    hash: CryptoHash;
} | {
    type: 'KVHash';
    kvHash: CryptoHash;
} | {
    type: 'KV';
    key: Uint8Array;
    value: Uint8Array;
} | {
    type: 'KVValueHash';
    key: Uint8Array;
    value: Uint8Array;
    valueHash: CryptoHash;
} | {
    type: 'KVDigest';
    key: Uint8Array;
    valueHash: CryptoHash;
} | {
    type: 'KVRefValueHash';
    key: Uint8Array;
    value: Uint8Array;
    valueHash: CryptoHash;
} | {
    type: 'KVValueHashFeatureType';
    key: Uint8Array;
    value: Uint8Array;
    valueHash: CryptoHash;
    featureType: TreeFeatureType;
};
/**
 * Merk proof operations
 */
type MerkOp = {
    type: 'Push';
    node: MerkNode;
} | {
    type: 'PushInverted';
    node: MerkNode;
} | {
    type: 'Parent';
} | {
    type: 'Child';
} | {
    type: 'ParentInverted';
} | {
    type: 'ChildInverted';
};
/**
 * Prove options
 */
interface ProveOptions {
    decreaseLimitOnEmptySubQueryResult: boolean;
}
/**
 * Layer proof - contains Merk proof and nested subtree proofs
 */
interface LayerProof {
    merkProof: Uint8Array;
    lowerLayers: Map<string, LayerProof>;
}
/**
 * GroveDB Proof V0
 */
interface GroveDBProofV0 {
    rootLayer: LayerProof;
    proveOptions: ProveOptions;
}
/**
 * GroveDB Proof (versioned enum)
 */
type GroveDBProof = {
    version: 0;
    proof: GroveDBProofV0;
};
/**
 * Proved key-value pair from verification
 */
interface ProvedKeyValue {
    key: Uint8Array;
    value: Uint8Array | null;
    proof: CryptoHash;
}
/**
 * GroveDB Element types (subset needed for verification)
 */
type Element = {
    type: 'Item';
    value: Uint8Array;
    flags: Uint8Array | null;
} | {
    type: 'Reference';
    path: Uint8Array[][];
    flags: Uint8Array | null;
} | {
    type: 'Tree';
    rootKey: Uint8Array | null;
    flags: Uint8Array | null;
} | {
    type: 'SumTree';
    rootKey: Uint8Array | null;
    sumValue: bigint;
    flags: Uint8Array | null;
} | {
    type: 'SumItem';
    value: bigint;
    flags: Uint8Array | null;
} | {
    type: 'BigSumTree';
    rootKey: Uint8Array | null;
    sumValue: bigint;
    flags: Uint8Array | null;
} | {
    type: 'CountTree';
    rootKey: Uint8Array | null;
    count: bigint;
    flags: Uint8Array | null;
} | {
    type: 'CountSumTree';
    rootKey: Uint8Array | null;
    count: bigint;
    sum: bigint;
    flags: Uint8Array | null;
};
/**
 * Verification error
 */
declare class GroveDBVerificationError extends Error {
    constructor(message: string);
}

/**
 * GroveDB Proof Verifier
 *
 * Main entry point for verifying GroveDB proofs.
 * Handles nested layer verification and returns proven results.
 */

/**
 * Result of verifying a GroveDB proof
 */
interface GroveDBVerificationResult {
    /** Root hash of the entire GroveDB tree */
    rootHash: CryptoHash;
    /** Proven key-value pairs with their paths */
    results: Array<{
        path: Uint8Array[];
        key: Uint8Array;
        value: Uint8Array | null;
        element: Element | null;
    }>;
}
/**
 * Options for proof verification
 */
interface VerifyOptions {
    /** Maximum number of results to return */
    limit?: number;
    /** Whether to deserialize element values */
    deserializeElements?: boolean;
}
/**
 * Verify a GroveDB proof and return the root hash and proven values
 *
 * @param proofBytes - The bincode-encoded GroveDBProof
 * @param options - Verification options
 * @returns Verification result with root hash and proven values
 */
declare function verifyGroveDBProof(proofBytes: Uint8Array, options?: VerifyOptions): GroveDBVerificationResult;
/**
 * Verify that a proof matches an expected root hash
 *
 * @param proofBytes - The bincode-encoded GroveDBProof
 * @param expectedRootHash - The expected root hash (from light client)
 * @param options - Verification options
 * @returns Verification result if valid, throws if invalid
 */
declare function verifyProofAgainstRoot(proofBytes: Uint8Array, expectedRootHash: CryptoHash, options?: VerifyOptions): GroveDBVerificationResult;
/**
 * Quick verification - just check if proof is valid and return root hash
 * Does not parse elements or return results
 */
declare function quickVerify(proofBytes: Uint8Array): CryptoHash;

/**
 * Bincode 2 reader + hex helpers.
 *
 * Implements the wire format used by `bincode = "2.0.0-rc.3"` with
 * `config::standard().with_big_endian().with_no_limit()`. This is the format
 * grovedb 3.1.0 uses for both `GroveDBProof` (emitted by `prove_query`) and
 * `Element` (stored as Merk leaf values).
 *
 * Wire format summary (from bincode-2.0.0-rc.3/src/varint/encode_unsigned.rs
 * and encode_signed.rs):
 *
 *   Unsigned varint (big-endian):
 *     0..=250           → 1 byte  (value as u8)
 *     251..=65535       → 1 byte tag 0xFB + u16 BE
 *     65536..=2^32-1    → 1 byte tag 0xFC + u32 BE
 *     2^32..=2^64-1     → 1 byte tag 0xFD + u64 BE
 *     2^64..=2^128-1    → 1 byte tag 0xFE + u128 BE
 *
 *   Signed varint: zigzag-encode first, then unsigned varint.
 *     zigzag_i64(n)  = (n << 1) ^ (n >> 63)
 *     zigzag_i128(n) = (n << 1) ^ (n >> 127)
 *
 *   Enum variant: u32-as-varint (so V0 is 0x00)
 *   Vec<u8>/String: usize-as-varint (u64 form) + bytes
 *   BTreeMap / Vec<T>: length-as-varint + entries
 *   Option<T>: 1 byte tag (0=None, 1=Some) + T
 *   bool: 1 byte (0 or 1)
 *   Structs: fields in declaration order, no length prefix
 */
declare class BincodeReader {
    private readonly data;
    private view;
    private offset;
    constructor(data: Uint8Array);
    position(): number;
    remaining(): number;
    hasMore(): boolean;
    private requireBytes;
    readU8(): number;
    readBool(): boolean;
    /**
     * Read a variable-length unsigned integer. Returns a bigint since the wire
     * format supports up to u128.
     */
    readVarintU128(): bigint;
    /**
     * Read a varint as bigint (u64-range).
     */
    readVarintU64(): bigint;
    /**
     * Read a varint that is expected to fit in a JS Number (<= 2^53-1).
     */
    readVarintAsNumber(): number;
    /**
     * Read a zigzag-encoded signed i64 varint.
     *
     * zigzag_decode(v) = (v >> 1) ^ -(v & 1)
     */
    readVarintI64(): bigint;
    /**
     * Read a zigzag-encoded signed i128 varint.
     */
    readVarintI128(): bigint;
    /**
     * Read an enum variant tag. In bincode 2, enum discriminants are encoded as
     * u32-as-varint.
     */
    readVariant(): number;
    /**
     * Read a Vec<u8> or any length-prefixed byte sequence.
     */
    readByteVec(): Uint8Array;
    /**
     * Read a sequence length prefix (for Vec<T>, BTreeMap, etc).
     */
    readLength(): number;
    /**
     * Read `Option<Vec<u8>>`: 1 byte tag + optional bytes.
     */
    readOptionByteVec(): Uint8Array | null;
    /**
     * Read `Option<u8>`: 1 byte tag + optional single byte.
     */
    readOptionU8(): number | null;
    /**
     * Read `Vec<Vec<u8>>` (length + repeated byte vecs).
     */
    readVecOfByteVec(): Uint8Array[];
}
declare function bytesToHex(bytes: Uint8Array): string;
declare function hexToBytes(hex: string): Uint8Array;

/**
 * Bincode 2 decoder for `GroveDBProof`.
 *
 * Schema (grovedb-3.1.0/src/operations/proof/mod.rs):
 *
 *   pub enum GroveDBProof {
 *       V0(GroveDBProofV0),
 *   }
 *   pub struct GroveDBProofV0 {
 *       pub root_layer: LayerProof,
 *       pub prove_options: ProveOptions,
 *   }
 *   pub struct LayerProof {
 *       pub merk_proof: Vec<u8>,
 *       pub lower_layers: BTreeMap<Key, LayerProof>,  // Key = Vec<u8>
 *   }
 *   pub struct ProveOptions {
 *       pub decrease_limit_on_empty_sub_query_result: bool,
 *   }
 */

declare function decodeGroveDBProof(bytes: Uint8Array): GroveDBProof;

/**
 * GroveDB Hash Functions
 *
 * All hash functions use BLAKE3, matching the Rust implementation.
 *
 * We use `@noble/hashes/blake3` (pure TS, sync, isomorphic) rather than the
 * `blake3` npm package, which has a Node/browser split where the default
 * entry point requires async WebAssembly loading in browsers. `@noble/hashes`
 * is already a transitive dependency via other modules and works the same
 * way in Node, the browser, and any bundler target.
 */

/**
 * Compute BLAKE3 hash of data
 */
declare function blake3Hash(data: Uint8Array): CryptoHash;
/**
 * Hash a value with its length prefix
 * value_hash(value) = BLAKE3(varint(value.length) || value)
 */
declare function valueHash(value: Uint8Array): CryptoHash;
/**
 * Hash a key-value pair
 * kv_hash(key, value) = BLAKE3(varint(key.length) || key || value_hash(value))
 */
declare function kvHash(key: Uint8Array, value: Uint8Array): CryptoHash;
/**
 * Compute kv_hash from key and pre-computed value hash
 * kv_digest_to_kv_hash(key, value_hash) = BLAKE3(varint(key.length) || key || value_hash)
 */
declare function kvDigestToKvHash(key: Uint8Array, valHash: CryptoHash): CryptoHash;
/**
 * Hash a node with its children
 * node_hash(kv, left, right) = BLAKE3(kv || left || right)
 */
declare function nodeHash(kv: CryptoHash, left: CryptoHash, right: CryptoHash): CryptoHash;
/**
 * Combine two hashes
 * combine_hash(a, b) = BLAKE3(a || b)
 */
declare function combineHash(a: CryptoHash, b: CryptoHash): CryptoHash;
/**
 * Check if two hashes are equal
 */
declare function hashEquals(a: CryptoHash, b: CryptoHash): boolean;
/**
 * Convert hash to hex string
 */
declare function hashToHex(h: CryptoHash): string;
/**
 * Convert hex string to hash
 */
declare function hexToHash(hex: string): CryptoHash;

/**
 * Merk Operation Decoder
 *
 * Decodes the binary format of Merk proof operations.
 */

/**
 * Decoder class for iterating through Merk operations
 */
declare class MerkDecoder implements Iterable<MerkOp> {
    private bytes;
    private offset;
    constructor(bytes: Uint8Array);
    /**
     * Check if there are more operations to decode
     */
    hasMore(): boolean;
    /**
     * Decode the next operation
     */
    next(): MerkOp | null;
    /**
     * Decode a Hash node
     */
    private decodeHash;
    /**
     * Decode a KVHash node
     */
    private decodeKVHash;
    /**
     * Decode a KV node
     */
    private decodeKV;
    /**
     * Decode a KVValueHash node
     */
    private decodeKVValueHash;
    /**
     * Decode a KVDigest node
     */
    private decodeKVDigest;
    /**
     * Decode a KVRefValueHash node
     */
    private decodeKVRefValueHash;
    /**
     * Decode a KVValueHashFeatureType node
     */
    private decodeKVValueHashFeatureType;
    /**
     * Decode TreeFeatureType
     */
    private decodeFeatureType;
    /**
     * Read a big-endian u16
     */
    private readU16;
    /**
     * Read a fixed number of bytes
     */
    private readBytes;
    /**
     * Iterator implementation
     */
    [Symbol.iterator](): Iterator<MerkOp>;
}
/**
 * Decode all Merk operations from bytes
 */
declare function decodeMerkOps(bytes: Uint8Array): MerkOp[];

/**
 * Merk Tree Data Structure
 *
 * Represents the tree structure built during proof execution.
 */

/**
 * Child node with cached hash
 */
interface Child {
    tree: Tree;
    hash: CryptoHash;
}
/**
 * Binary tree for proof verification
 */
declare class Tree {
    node: MerkNode;
    left: Child | null;
    right: Child | null;
    height: number;
    childHeights: [number, number];
    constructor(node: MerkNode);
    /**
     * Compute the hash of this tree node
     */
    hash(): CryptoHash;
    /**
     * Compute the KV hash portion based on node type
     */
    private computeKVHash;
    /**
     * Get the hash of a child, or NULL_HASH if no child
     */
    childHash(left: boolean): CryptoHash;
    /**
     * Attach a child to this node
     */
    attach(left: boolean, child: Tree): void;
    /**
     * Attach a child to this node with explicit height
     * This is used when the child may have been collapsed (hash converted)
     * and we need to preserve the original height for AVL checking
     */
    attachWithHeight(left: boolean, child: Tree, originalHeight: number): void;
    /**
     * Convert this tree to a hash-only node (for memory efficiency during execution)
     */
    intoHash(): Tree;
    /**
     * Get the key from this node (if it has one)
     */
    getKey(): Uint8Array | null;
    /**
     * Get the value from this node (if it has one)
     */
    getValue(): Uint8Array | null;
    /**
     * Get the value hash from this node
     */
    getValueHash(): CryptoHash | null;
    /**
     * Check if this node has key-value data
     */
    hasKV(): boolean;
    /**
     * In-order traversal of the tree
     */
    inOrder(): Generator<Tree>;
}
/**
 * Compare two byte arrays
 */
declare function compareBytes(a: Uint8Array, b: Uint8Array): number;

/**
 * Merk Proof Stack Machine Executor
 *
 * Executes Merk proof operations using a stack-based approach.
 */

/**
 * Result of executing a Merk proof
 */
interface MerkExecutionResult {
    /** Root hash of the verified tree */
    rootHash: CryptoHash;
    /** Key-value pairs proven by the proof */
    resultSet: ProvedKeyValue[];
    /** Remaining limit after execution (if limit was set) */
    limit: number | null;
}
/**
 * Execute Merk proof operations and return the resulting tree
 *
 * @param ops - Iterator of Merk operations
 * @param collapse - If true, convert children to hashes to save memory
 * @param visitNode - Optional callback for each node
 * @returns The resulting tree
 */
declare function executeOps(ops: Iterable<MerkOp>, collapse?: boolean, visitNode?: (node: MerkNode) => void): Tree;
/**
 * Execute a Merk proof from bytes
 */
declare function executeMerkProof(proofBytes: Uint8Array, collapse?: boolean): Tree;
/**
 * Execute a Merk proof and extract results matching a query
 *
 * @param proofBytes - The Merk proof bytes
 * @param limit - Optional limit on results
 * @param leftToRight - Direction of traversal
 * @returns Execution result with root hash and matched values
 */
declare function executeMerkProofWithQuery(proofBytes: Uint8Array, limit?: number | null, leftToRight?: boolean): MerkExecutionResult;

/**
 * GroveDB `Element` deserialization.
 *
 * Matches the bincode 2 wire format used by grovedb 3.1.0. The Rust type is:
 *
 *   pub enum Element {
 *       Item(Vec<u8>, Option<ElementFlags>),
 *       Reference(ReferencePathType, MaxReferenceHop, Option<ElementFlags>),
 *       Tree(Option<Vec<u8>>, Option<ElementFlags>),
 *       SumItem(SumValue, Option<ElementFlags>),
 *       SumTree(Option<Vec<u8>>, SumValue, Option<ElementFlags>),
 *       BigSumTree(Option<Vec<u8>>, BigSumValue, Option<ElementFlags>),
 *       CountTree(Option<Vec<u8>>, CountValue, Option<ElementFlags>),
 *       CountSumTree(Option<Vec<u8>>, CountValue, SumValue, Option<ElementFlags>),
 *   }
 *
 * where:
 *   ElementFlags = Vec<u8>
 *   MaxReferenceHop = Option<u8>
 *   SumValue = i64       (zigzag varint)
 *   BigSumValue = i128   (zigzag varint)
 *   CountValue = u64     (unsigned varint)
 *
 * `ReferencePathType` is a 7-variant enum (see reference_path.rs). Variants
 * use byte-slice payloads and small u8 heights; all encoded with bincode 2.
 */

declare function deserializeElement(bytes: Uint8Array): Element;
declare function isTreeElement(element: Element): boolean;
declare function hasRootKey(element: Element): boolean;
declare function getTreeFeatureType(element: Element): string | null;

/**
 * Varint Encoding/Decoding
 *
 * LEB128-style variable-length integer encoding used by GroveDB.
 */
/**
 * Varint decoding error
 */
declare class VarintError extends Error {
    constructor(message: string);
}
/**
 * Encode a number as a varint
 */
declare function encodeVarint(value: number): Uint8Array;
/**
 * Decode a varint from bytes, returning the value and bytes consumed
 */
declare function decodeVarint(bytes: Uint8Array, offset?: number): {
    value: number;
    bytesRead: number;
};
/**
 * Decode a signed varint (zigzag encoded)
 */
declare function decodeSignedVarint(bytes: Uint8Array, offset?: number): {
    value: number;
    bytesRead: number;
};
/**
 * Decode a 64-bit signed varint as bigint
 */
declare function decodeSignedVarint64(bytes: Uint8Array, offset?: number): {
    value: bigint;
    bytesRead: number;
};
/**
 * Decode an unsigned 64-bit varint as bigint
 */
declare function decodeVarint64(bytes: Uint8Array, offset?: number): {
    value: bigint;
    bytesRead: number;
};

/**
 * GroveDB Proof Verification Module
 *
 * Pure TypeScript implementation of GroveDB proof verification.
 * This allows trustless verification of data returned by Willow nodes.
 */

type index$1_BincodeReader = BincodeReader;
declare const index$1_BincodeReader: typeof BincodeReader;
type index$1_Child = Child;
type index$1_CryptoHash = CryptoHash;
type index$1_Element = Element;
type index$1_GroveDBProof = GroveDBProof;
type index$1_GroveDBProofV0 = GroveDBProofV0;
type index$1_GroveDBVerificationError = GroveDBVerificationError;
declare const index$1_GroveDBVerificationError: typeof GroveDBVerificationError;
type index$1_GroveDBVerificationResult = GroveDBVerificationResult;
declare const index$1_HASH_LENGTH: typeof HASH_LENGTH;
type index$1_LayerProof = LayerProof;
type index$1_MerkDecoder = MerkDecoder;
declare const index$1_MerkDecoder: typeof MerkDecoder;
type index$1_MerkExecutionResult = MerkExecutionResult;
type index$1_MerkNode = MerkNode;
type index$1_MerkOp = MerkOp;
declare const index$1_NULL_HASH: typeof NULL_HASH;
type index$1_ProveOptions = ProveOptions;
type index$1_ProvedKeyValue = ProvedKeyValue;
type index$1_Tree = Tree;
declare const index$1_Tree: typeof Tree;
type index$1_TreeFeatureType = TreeFeatureType;
type index$1_VarintError = VarintError;
declare const index$1_VarintError: typeof VarintError;
type index$1_VerifyOptions = VerifyOptions;
declare const index$1_blake3Hash: typeof blake3Hash;
declare const index$1_bytesToHex: typeof bytesToHex;
declare const index$1_combineHash: typeof combineHash;
declare const index$1_compareBytes: typeof compareBytes;
declare const index$1_decodeGroveDBProof: typeof decodeGroveDBProof;
declare const index$1_decodeMerkOps: typeof decodeMerkOps;
declare const index$1_decodeSignedVarint: typeof decodeSignedVarint;
declare const index$1_decodeSignedVarint64: typeof decodeSignedVarint64;
declare const index$1_decodeVarint: typeof decodeVarint;
declare const index$1_decodeVarint64: typeof decodeVarint64;
declare const index$1_deserializeElement: typeof deserializeElement;
declare const index$1_encodeVarint: typeof encodeVarint;
declare const index$1_executeMerkProof: typeof executeMerkProof;
declare const index$1_executeMerkProofWithQuery: typeof executeMerkProofWithQuery;
declare const index$1_executeOps: typeof executeOps;
declare const index$1_getTreeFeatureType: typeof getTreeFeatureType;
declare const index$1_hasRootKey: typeof hasRootKey;
declare const index$1_hashEquals: typeof hashEquals;
declare const index$1_hashToHex: typeof hashToHex;
declare const index$1_hexToBytes: typeof hexToBytes;
declare const index$1_hexToHash: typeof hexToHash;
declare const index$1_isTreeElement: typeof isTreeElement;
declare const index$1_kvDigestToKvHash: typeof kvDigestToKvHash;
declare const index$1_kvHash: typeof kvHash;
declare const index$1_nodeHash: typeof nodeHash;
declare const index$1_quickVerify: typeof quickVerify;
declare const index$1_valueHash: typeof valueHash;
declare const index$1_verifyGroveDBProof: typeof verifyGroveDBProof;
declare const index$1_verifyProofAgainstRoot: typeof verifyProofAgainstRoot;
declare namespace index$1 {
  export { index$1_BincodeReader as BincodeReader, type index$1_Child as Child, type index$1_CryptoHash as CryptoHash, type index$1_Element as Element, type index$1_GroveDBProof as GroveDBProof, type index$1_GroveDBProofV0 as GroveDBProofV0, index$1_GroveDBVerificationError as GroveDBVerificationError, type index$1_GroveDBVerificationResult as GroveDBVerificationResult, index$1_HASH_LENGTH as HASH_LENGTH, type index$1_LayerProof as LayerProof, index$1_MerkDecoder as MerkDecoder, type index$1_MerkExecutionResult as MerkExecutionResult, type index$1_MerkNode as MerkNode, type index$1_MerkOp as MerkOp, index$1_NULL_HASH as NULL_HASH, type index$1_ProveOptions as ProveOptions, type index$1_ProvedKeyValue as ProvedKeyValue, index$1_Tree as Tree, type index$1_TreeFeatureType as TreeFeatureType, index$1_VarintError as VarintError, type index$1_VerifyOptions as VerifyOptions, index$1_blake3Hash as blake3Hash, index$1_bytesToHex as bytesToHex, index$1_combineHash as combineHash, index$1_compareBytes as compareBytes, index$1_decodeGroveDBProof as decodeGroveDBProof, index$1_decodeMerkOps as decodeMerkOps, index$1_decodeSignedVarint as decodeSignedVarint, index$1_decodeSignedVarint64 as decodeSignedVarint64, index$1_decodeVarint as decodeVarint, index$1_decodeVarint64 as decodeVarint64, index$1_deserializeElement as deserializeElement, index$1_encodeVarint as encodeVarint, index$1_executeMerkProof as executeMerkProof, index$1_executeMerkProofWithQuery as executeMerkProofWithQuery, index$1_executeOps as executeOps, index$1_getTreeFeatureType as getTreeFeatureType, index$1_hasRootKey as hasRootKey, index$1_hashEquals as hashEquals, index$1_hashToHex as hashToHex, index$1_hexToBytes as hexToBytes, index$1_hexToHash as hexToHash, index$1_isTreeElement as isTreeElement, index$1_kvDigestToKvHash as kvDigestToKvHash, index$1_kvHash as kvHash, index$1_nodeHash as nodeHash, index$1_quickVerify as quickVerify, index$1_valueHash as valueHash, index$1_verifyGroveDBProof as verifyGroveDBProof, index$1_verifyProofAgainstRoot as verifyProofAgainstRoot };
}

/**
 * Canonical chain identifiers accepted by Willow's consensus validator.
 *
 * Mirrors `willow_types::consensus::SupportedChain` in the Rust workspace —
 * any new chain must land in both places at the same time. Identifiers are
 * lowercase kebab-case (subgraph convention); no aliases are accepted by
 * the validator, so callers must use the exact string here.
 */
declare const SUPPORTED_CHAINS: readonly ["mainnet", "sepolia", "holesky", "bsc", "optimism", "arbitrum-one", "base", "polygon", "solana-mainnet"];
type SupportedChain = (typeof SUPPORTED_CHAINS)[number];
type ChainFamily = "evm" | "solana";
/** Family the chain belongs to. Drives manifest data-source dispatch. */
declare function chainFamily(chain: SupportedChain): ChainFamily;
/** EIP-155 chain id for EVM-family chains, `null` for Solana. */
declare function evmChainId(chain: SupportedChain): number | null;
/** Type guard — matches the Rust `SupportedChain::from_canonical_id` set. */
declare function isSupportedChain(s: string): s is SupportedChain;
/** Map an EIP-155 chain id back to the canonical chain. */
declare function fromEvmChainId(id: number): SupportedChain | null;

/**
 * Canonical `WillowManifest` builder.
 *
 * Mirrors `willow_types::consensus::manifest::WillowManifest` in the Rust
 * workspace. The consensus validator rejects any `manifest_content` that
 * doesn't decode into this exact shape, so SDK callers should always
 * build their on-chain manifest bytes via `serializeManifest`. Each data
 * source is either EVM (`address` + `abi` + `start_block` + `events`) or
 * Solana (`program_id` + `start_slot` + `instructions`); the family is
 * dispatched at parse time from the `network` field.
 */

/** Schema version pinned by the consensus validator. */
declare const MANIFEST_SPEC_VERSION = "1.0.0";
/** Mirrors `willow_types::consensus::manifest::MAX_*` constants. */
declare const MAX_DATA_SOURCES = 64;
declare const MAX_EVENTS_PER_SOURCE = 32;
declare const MAX_NAME_LEN = 64;
declare const MAX_ABI_LEN = 64;
declare const MAX_DESCRIPTION_LEN = 1024;
/** One indexed EVM contract within a manifest. */
interface EvmDataSource {
    name: string;
    network: SupportedChain;
    /** `0x` + 40 lowercase hex chars. Mixed-case input is normalized on serialize. */
    address: string;
    abi: string;
    start_block: number;
    /** Solidity event signatures, e.g. `Transfer(address,address,uint256)`. */
    events: string[];
}
/** One indexed Solana program within a manifest. */
interface SolanaDataSource {
    name: string;
    network: SupportedChain;
    /** Base58-encoded 32-byte program id. */
    program_id: string;
    start_slot: number;
    /** Variable-length instruction discriminators, `0x` + even hex chars (>=2). */
    instructions: string[];
}
type DataSource = EvmDataSource | SolanaDataSource;
/** Type guard: data source is EVM (has `address` field). */
declare function isEvmDataSource(ds: DataSource): ds is EvmDataSource;
/** Type guard: data source is Solana (has `program_id` field). */
declare function isSolanaDataSource(ds: DataSource): ds is SolanaDataSource;
interface WillowManifest {
    spec_version: typeof MANIFEST_SPEC_VERSION;
    description?: string;
    data_sources: DataSource[];
}
/**
 * Validate + serialize a manifest into the canonical JSON byte form that
 * goes on-chain via `SubgroveMode.BlockchainIndexing.manifest_content`.
 *
 * Throws a `ManifestValidationError` with a `field` path on the first
 * problem found.
 */
declare function serializeManifest(m: WillowManifest): Uint8Array;
/**
 * Parse + validate canonical manifest bytes. Accepts the `Uint8Array`
 * that consensus returns (e.g. via `manifest_content`) or a JSON string.
 */
declare function parseManifest(input: Uint8Array | string): WillowManifest;
declare class ManifestValidationError extends Error {
    readonly field: string;
    constructor(message: string, field: string);
}
/**
 * Validate a `WillowManifest`. Same rules as `WillowManifest::from_bytes`
 * + `WillowManifest::validate()` in the Rust workspace.
 */
declare function validateManifest(m: WillowManifest): void;

type index_ChainFamily = ChainFamily;
type index_DataSource = DataSource;
type index_EvmDataSource = EvmDataSource;
declare const index_MANIFEST_SPEC_VERSION: typeof MANIFEST_SPEC_VERSION;
declare const index_MAX_ABI_LEN: typeof MAX_ABI_LEN;
declare const index_MAX_DATA_SOURCES: typeof MAX_DATA_SOURCES;
declare const index_MAX_DESCRIPTION_LEN: typeof MAX_DESCRIPTION_LEN;
declare const index_MAX_EVENTS_PER_SOURCE: typeof MAX_EVENTS_PER_SOURCE;
declare const index_MAX_NAME_LEN: typeof MAX_NAME_LEN;
type index_ManifestValidationError = ManifestValidationError;
declare const index_ManifestValidationError: typeof ManifestValidationError;
declare const index_SUPPORTED_CHAINS: typeof SUPPORTED_CHAINS;
type index_SolanaDataSource = SolanaDataSource;
type index_SupportedChain = SupportedChain;
type index_WillowManifest = WillowManifest;
declare const index_chainFamily: typeof chainFamily;
declare const index_evmChainId: typeof evmChainId;
declare const index_fromEvmChainId: typeof fromEvmChainId;
declare const index_isEvmDataSource: typeof isEvmDataSource;
declare const index_isSolanaDataSource: typeof isSolanaDataSource;
declare const index_isSupportedChain: typeof isSupportedChain;
declare const index_parseManifest: typeof parseManifest;
declare const index_serializeManifest: typeof serializeManifest;
declare const index_validateManifest: typeof validateManifest;
declare namespace index {
  export { type index_ChainFamily as ChainFamily, type index_DataSource as DataSource, type index_EvmDataSource as EvmDataSource, index_MANIFEST_SPEC_VERSION as MANIFEST_SPEC_VERSION, index_MAX_ABI_LEN as MAX_ABI_LEN, index_MAX_DATA_SOURCES as MAX_DATA_SOURCES, index_MAX_DESCRIPTION_LEN as MAX_DESCRIPTION_LEN, index_MAX_EVENTS_PER_SOURCE as MAX_EVENTS_PER_SOURCE, index_MAX_NAME_LEN as MAX_NAME_LEN, index_ManifestValidationError as ManifestValidationError, index_SUPPORTED_CHAINS as SUPPORTED_CHAINS, type index_SolanaDataSource as SolanaDataSource, type index_SupportedChain as SupportedChain, type index_WillowManifest as WillowManifest, index_chainFamily as chainFamily, index_evmChainId as evmChainId, index_fromEvmChainId as fromEvmChainId, index_isEvmDataSource as isEvmDataSource, index_isSolanaDataSource as isSolanaDataSource, index_isSupportedChain as isSupportedChain, index_parseManifest as parseManifest, index_serializeManifest as serializeManifest, index_validateManifest as validateManifest };
}

/**
 * Trust threshold for validator consensus (e.g., 2/3+ validators)
 */
interface TrustThreshold {
    numerator: number;
    denominator: number;
}
/**
 * Individual validator information
 */
interface Validator {
    address: Uint8Array;
    pubKey: Uint8Array;
    votingPower: number;
    proposerPriority?: number;
}
/**
 * Set of validators for a specific block
 */
interface ValidatorSet {
    validators: Validator[];
    proposer?: Validator;
    totalVotingPower?: number;
}
/**
 * Block identifier containing hash and part set header
 */
interface BlockId {
    hash: Uint8Array;
    partSetHeaderTotal: number;
    partSetHeaderHash: Uint8Array;
}
/**
 * Block header containing consensus metadata
 */
interface Header {
    version: {
        block: number;
        app: number;
    };
    chainId: string;
    height: number;
    time: Date;
    lastBlockId?: BlockId;
    lastCommitHash: Uint8Array;
    dataHash: Uint8Array;
    validatorsHash: Uint8Array;
    nextValidatorsHash: Uint8Array;
    consensusHash: Uint8Array;
    appHash: Uint8Array;
    lastResultsHash: Uint8Array;
    evidenceHash: Uint8Array;
    proposerAddress: Uint8Array;
}
/**
 * Individual validator's commit signature
 */
interface CommitSig {
    blockIdFlag: number;
    validatorAddress: Uint8Array;
    timestamp: Date;
    signature?: Uint8Array;
}
/**
 * Block commit containing validator signatures
 */
interface Commit {
    height: number;
    round: number;
    blockId: BlockId;
    signatures: CommitSig[];
}
/**
 * Complete light block containing header, commit, and validator set
 */
interface LightBlock {
    header: Header;
    commit: Commit;
    validators: ValidatorSet;
    nextValidators?: ValidatorSet;
    provider?: string;
}
/**
 * Trusted header for state export/import
 */
interface TrustedHeader {
    header: Header;
    validatorsHash: Uint8Array;
    nextValidatorsHash: Uint8Array;
    trustedAt: Date;
    provider?: string;
}
/**
 * GroveDB query proof with verification metadata.
 *
 * This is the *internal* proof format the light client operates on
 * (raw bytes + path query). It is distinct from the top-level
 * `QueryProof` in `../types/index.ts`, which is the wire shape
 * returned by the server for SQL / GraphQL query responses. The two
 * used to share a name and caused tsup DTS naming collisions
 * (`QueryProof$1`) in downstream packages.
 */
interface GroveDBQueryProof {
    proof: Uint8Array;
    pathQuery: any;
    height: number;
    queryResult?: Uint8Array[];
}
/**
 * Result of header or proof verification
 */
interface VerificationResult {
    success: boolean;
    error?: string;
    height?: number;
    nextHeight?: number;
    trustLevel?: number;
}
/**
 * Configuration for light client operation
 */
interface LightClientConfig {
    chainId: string;
    validatorEndpoints: string[];
    trustThreshold?: TrustThreshold;
    trustingPeriodSecs?: number;
    maxClockDriftSecs?: number;
    minValidatorsForConsensus?: number;
    autoSync?: boolean;
    syncIntervalSecs?: number;
    maxRetries?: number;
    requestTimeoutSecs?: number;
}

/**
 * Light Client Implementation
 *
 * Provides cryptographically secure data verification through CometBFT light client protocol
 * and GroveDB proof verification.
 */

/**
 * CometBFT light client with GroveDB proof verification
 *
 * Provides cryptographically secure data verification without running a full node.
 */
declare class LightClient {
    private config;
    private headerVerifier;
    private proofVerifier;
    private trustedHeaders;
    private latestHeight?;
    private syncIntervalId?;
    private verifiedHeightRange?;
    constructor(config: LightClientConfig);
    /**
     * Start the light client and begin synchronization
     */
    start(): Promise<void>;
    /**
     * Stop the light client and cleanup resources
     */
    stop(): Promise<void>;
    /**
     * Initialize the light client using trust-on-first-use.
     *
     * This fetches the latest block from validators and trusts it as the initial state.
     * All subsequent blocks are verified against this initial trusted state.
     *
     * @important TODO: When mainnet/testnet launches, replace trust-on-first-use
     * with hardcoded checkpoint headers for true trustless initialization.
     * Trust-on-first-use is secure for subsequent operations but trusts the
     * initial block from the connected validators.
     */
    initializeWithTrustOnFirstUse(): Promise<void>;
    /**
     * Initialize the light client with a trusted header
     *
     * This is the bootstrap process that establishes initial trust.
     * The trusted header should be obtained through a secure channel.
     */
    initializeWithTrustedHeader(trustedHeader: LightBlock): Promise<void>;
    /**
     * Verify a header against the current trusted state
     */
    verifyHeader(header: LightBlock): Promise<VerificationResult>;
    /**
     * Get a verified header by height
     */
    getHeaderByHeight(height: number): Promise<LightBlock | undefined>;
    /**
     * Get the latest verified header
     */
    getLatestHeader(): Promise<LightBlock | undefined>;
    /**
     * Synchronize to the latest blockchain state
     */
    syncToLatest(): Promise<VerificationResult>;
    /**
     * Verify a GroveDB query proof against verified headers
     */
    verifyQueryProof(proof: GroveDBQueryProof, height?: number): Promise<VerificationResult>;
    /**
     * Export trusted headers for state persistence
     */
    exportTrustedState(): Promise<TrustedHeader[]>;
    /**
     * Import trusted headers from exported state
     */
    importTrustedState(headers: TrustedHeader[]): Promise<void>;
    /**
     * Get the verified root hash (app_hash) from the latest trusted header.
     *
     * This is the cryptographically verified root hash that proofs should be
     * verified against for trustless data verification.
     */
    getVerifiedRootHash(): Promise<string>;
    /**
     * Get the verified root hash (app_hash) at a specific block height.
     *
     * In CometBFT, block H's FinalizeBlock produces an app_hash that represents
     * state AFTER H. That hash is then committed into block H+1's header as
     * `header.app_hash`. So:
     *
     *   - `block H+1.header.app_hash` = state after H (what we want for height H)
     *   - `status.latest_app_hash` = state after the latest committed block
     *
     * We used to use `/block_results` here, but CometBFT 0.38+ does NOT populate
     * `app_hash` in that response — it's intentionally empty. The canonical
     * source is the next block's header, with `/status` as the fallback when
     * height is the very latest (H+1 doesn't exist yet).
     *
     * When `height <= 0`, we fetch the latest app_hash via `/status`.
     */
    getVerifiedRootHashAtHeight(height: number): Promise<string>;
    /**
     * Fetches `app_hash` for the state AFTER the given block height.
     *
     * The canonical source is `block H+1.header.app_hash` — the header of the
     * next block carries the app_hash that resulted from executing block H.
     * If block H+1 hasn't been committed yet (i.e. H is the current tip), we
     * poll until it is, or we hit the timeout.
     *
     * We deliberately do NOT fall back to `/status.latest_app_hash`:
     * empirically that value equals `block latest.header.app_hash`, which is
     * state AFTER block `latest - 1`, not state after `latest`. Using it as a
     * fallback produces hashes one block behind the proof and causes
     * "root hash mismatch" on the client. The only correct way to get
     * state-after-H is the next block's header.
     *
     * When `height <= 0`, we interpret this as "give me whatever current
     * verified app_hash you can" — i.e. the hash for the most recent block
     * for which a next-block header exists. That's `block latest.header.app_hash`
     * (= state after latest-1). This is lossy but matches pre-existing callers
     * of `getVerifiedRootHash()`.
     */
    private fetchAppHashForHeight;
    private tryFetchBlockHeaderAppHash;
    private fetchStatus;
    /**
     * Get the latest verified height
     */
    getLatestHeight(): Promise<number | undefined>;
    /**
     * Get the range of verified heights (min, max)
     */
    getVerifiedHeightRange(): Promise<[number, number] | undefined>;
    /**
     * Check if a specific height has been verified
     */
    isHeightVerified(height: number): Promise<boolean>;
    /**
     * Find the best trusted header for verifying target height
     */
    private findBestTrustedHeader;
    /**
     * Add a verified header to the trusted set
     */
    private addTrustedHeader;
    /**
     * Fetch header from validators with consensus verification
     */
    private fetchHeaderFromValidators;
    /**
     * Fetch header from a specific validator endpoint
     */
    private fetchHeaderFromEndpoint;
    /**
     * Get latest height from validators
     */
    private getLatestHeightFromValidators;
    /**
     * Find consensus header from multiple validator responses
     */
    private findConsensusHeader;
}

/**
 * Light Client Verification
 *
 * Header verification using CometBFT light client protocol and GroveDB proof verification.
 * Uses @noble/curves for Ed25519 and secp256k1 signature verification.
 */

/**
 * Verifies block headers using CometBFT light client protocol
 */
declare class HeaderVerifier {
    private chainId;
    private trustThreshold;
    constructor(chainId: string, trustThreshold: TrustThreshold);
    /**
     * Verify an untrusted header against a trusted state
     */
    verifyHeader(untrustedHeader: LightBlock, trustedHeader?: LightBlock, trustedValidators?: ValidatorSet, maxClockDriftSecs?: number): Promise<VerificationResult>;
    /**
     * Validate basic header properties
     */
    private validateBasicHeader;
    /**
     * Verify sequential header progression
     */
    private verifySequential;
    /**
     * Verify commit signatures and calculate voting power
     */
    private verifyCommitSignatures;
    /**
     * Verify individual validator signature using Ed25519
     */
    private verifySignature;
    /**
     * Create canonical sign bytes for CometBFT vote signature verification
     *
     * This follows the CometBFT canonical JSON encoding for votes.
     * See: https://github.com/cometbft/cometbft/blob/main/types/canonical.go
     */
    private createVoteSignBytes;
    /**
     * Verify validator set hash transition
     */
    private verifyValidatorSetTransition;
    /**
     * Utility: Compare two Uint8Arrays for equality
     */
    private arraysEqual;
}
/**
 * Verifies GroveDB proofs against trusted headers
 */
declare class ProofVerifier {
    /**
     * Verify a GroveDB query proof against a trusted app hash
     */
    verifyQueryProof(proof: GroveDBQueryProof, trustedAppHash: Uint8Array, queryResult?: Uint8Array[]): Promise<VerificationResult>;
    /**
     * Verify GroveDB proof and return computed root hash
     *
     * Note: Full GroveDB proof verification requires parsing the binary proof format.
     * This implementation extracts the root hash from the proof structure.
     * For full verification, use the server-assisted /verify-proof endpoint.
     */
    private verifyGroveDbProof;
    /**
     * Check if a byte sequence looks like a hash (has reasonable entropy)
     */
    private looksLikeHash;
    /**
     * Verify that a key-value pair is included in the tree
     */
    verifyInclusionProof(key: Uint8Array, value: Uint8Array, proofBytes: Uint8Array, trustedRoot: Uint8Array): Promise<boolean>;
    /**
     * Verify that a key is absent from the tree
     */
    verifyAbsenceProof(key: Uint8Array, proofBytes: Uint8Array, trustedRoot: Uint8Array): Promise<boolean>;
    /**
     * Utility: Compare two Uint8Arrays for equality
     */
    private arraysEqual;
    /**
     * Utility: Concatenate multiple Uint8Arrays
     */
    private concatArrays;
}

/**
 * Light Client Configuration Builder
 *
 * Provides a fluent builder pattern for configuring the light client.
 */

/**
 * Builder for creating light client configurations
 */
declare class LightClientConfigBuilder {
    private _chainId;
    private _validatorEndpoints;
    private _trustThreshold;
    private _trustingPeriodSecs;
    private _maxClockDriftSecs;
    private _minValidatorsForConsensus;
    private _autoSync;
    private _syncIntervalSecs;
    private _maxRetries;
    private _requestTimeoutSecs;
    /**
     * Initialize builder with required chain ID
     */
    constructor(chainId: string);
    /**
     * Set validator RPC endpoints
     */
    validatorEndpoints(endpoints: string[]): LightClientConfigBuilder;
    /**
     * Add a single validator RPC endpoint
     */
    addValidatorEndpoint(endpoint: string): LightClientConfigBuilder;
    /**
     * Set trust threshold (e.g., 2/3 for 2/3+ consensus)
     */
    trustThreshold(numerator: number, denominator: number): LightClientConfigBuilder;
    /**
     * Set trusting period in seconds
     */
    trustingPeriodSecs(seconds: number): LightClientConfigBuilder;
    /**
     * Set trusting period in hours
     */
    trustingPeriodHours(hours: number): LightClientConfigBuilder;
    /**
     * Set trusting period in days
     */
    trustingPeriodDays(days: number): LightClientConfigBuilder;
    /**
     * Set maximum allowed clock drift in seconds
     */
    maxClockDriftSecs(seconds: number): LightClientConfigBuilder;
    /**
     * Set minimum number of validators required for consensus
     */
    minValidatorsForConsensus(count: number): LightClientConfigBuilder;
    /**
     * Enable or disable automatic header synchronization
     */
    autoSync(enabled: boolean): LightClientConfigBuilder;
    /**
     * Set automatic sync interval in seconds
     */
    syncIntervalSecs(seconds: number): LightClientConfigBuilder;
    /**
     * Set automatic sync interval in minutes
     */
    syncIntervalMinutes(minutes: number): LightClientConfigBuilder;
    /**
     * Set maximum retry attempts for network requests
     */
    maxRetries(retries: number): LightClientConfigBuilder;
    /**
     * Set request timeout in seconds
     */
    requestTimeoutSecs(seconds: number): LightClientConfigBuilder;
    /**
     * Build the final configuration
     */
    build(): LightClientConfig;
}
/**
 * Convenience functions for common configurations
 */
/**
 * Create configuration for local testing
 */
declare function testConfig(chainId?: string): LightClientConfigBuilder;
/**
 * Create configuration for mainnet deployment
 */
declare function mainnetConfig(chainId: string): LightClientConfigBuilder;
/**
 * Create configuration optimized for fast synchronization
 */
declare function fastSyncConfig(chainId: string): LightClientConfigBuilder;

/**
 * Privacy module for Willow SDK.
 *
 * Provides key grant management for private subgroves, including
 * granting, revoking, and rotating encryption keys, as well as querying
 * key grants and their cryptographic proofs.
 */

/**
 * How often the provider must publish state root commitments on-chain.
 *
 * Mirrors the Rust `CommitmentFrequency` enum from `willow-types`.
 * Represented as a discriminated union matching the serde serialization.
 */
type CommitmentFrequency = "EveryUpdate" | {
    EveryNBlocks: number;
} | {
    EveryNSeconds: number;
} | "Never";
/** Convenience constructors for CommitmentFrequency. */
declare const CommitmentFrequency: {
    /** Commit after every write/block update (strongest freshness). */
    readonly everyUpdate: () => CommitmentFrequency;
    /** Commit every N blocks processed. */
    readonly everyNBlocks: (n: number) => CommitmentFrequency;
    /** Commit at least every N seconds. */
    readonly everyNSeconds: (n: number) => CommitmentFrequency;
    /** No on-chain commitments (trusted/internal scenarios only). */
    readonly never: () => CommitmentFrequency;
};
/**
 * Configuration for a private subgrove.
 *
 * Mirrors the Rust `PrivacyConfig` struct from `willow-types`.
 */
interface PrivacyConfig {
    /** Optional whitelist of indexer DIDs allowed to index this subgrove. */
    allowed_indexers?: string[];
    /** How often the provider must commit state roots to consensus. */
    commitment_frequency: CommitmentFrequency;
}
/**
 * Encrypted copy of a subgrove's symmetric key, wrapped for a specific reader DID.
 *
 * Mirrors the Rust `EncryptedKeyGrant` struct from `willow-types`.
 * The owner wraps the subgrove key for each authorized reader using ECDH.
 */
interface EncryptedKeyGrant {
    /** DID of the grantee receiving access. */
    grantee_did: string;
    /** Key epoch this grant belongs to. */
    key_epoch: number;
    /** ID of the grantee's public key used for ECDH. */
    grantee_public_key_id: string;
    /** Ephemeral public key for ECDH (32 bytes X25519, as byte array). */
    ephemeral_public_key: number[];
    /** nonce (24 bytes) || ciphertext || auth_tag (16 bytes), as byte array. */
    encrypted_key: number[];
    /** DID that granted this key. */
    granted_by: string;
    /** Unix timestamp when granted. */
    granted_at: number;
}
/**
 * Response from the key grant proof endpoint.
 */
interface KeyGrantProofResponse {
    /** Hex-encoded GroveDB Merkle proof. */
    proof: string;
    /** Application ID. */
    /** Subgrove ID. */
    subgrove_id: string;
    /** DID of the grantee. */
    grantee_did: string;
}
/**
 * Privacy operations for managing key grants on private subgroves.
 *
 * Read operations (get/list/proof) go through the REST API using auth headers.
 * Write operations (grant/revoke/rotate) build signed transactions and
 * broadcast them to CometBFT via the consensus JSON-RPC endpoint.
 *
 * @example
 * ```typescript
 * const auth = new WillowAuth('http://localhost:3031');
 * auth.setIdentity(did, privateKey, publicKeyId);
 *
 * const privacy = new PrivacyOperations(
 *   'http://localhost:3031',
 *   auth,
 *   privateKey,
 *   publicKeyId,
 * );
 *
 * // Read operations
 * const grant = await privacy.getMyKeyGrant('private-data');
 * const grantees = await privacy.listKeyGrantees('private-data');
 * const proof = await privacy.getKeyGrantProof('private-data', did);
 *
 * // Write operations (broadcast to consensus)
 * await privacy.grantSubgroveKey('private-data', encryptedGrant);
 * await privacy.revokeSubgroveKey('private-data', revokeDid);
 * await privacy.rotateSubgroveKey('private-data', 2, newGrants);
 * ```
 */
declare class PrivacyOperations {
    private api;
    private auth;
    private privateKey;
    private publicKeyId;
    private consensusRpcUrl;
    private apiUrl;
    /**
     * Create a new PrivacyOperations instance.
     *
     * @param apiUrl - Willow REST API base URL (e.g. "http://localhost:3031")
     * @param auth - WillowAuth instance with identity set (used for REST auth headers)
     * @param privateKey - Ed25519 private key hex (used for signing consensus transactions)
     * @param publicKeyId - Public key ID for the DID (e.g. "did:willow:abc#key-1")
     * @param consensusRpcUrl - CometBFT JSON-RPC URL. If omitted, derived from
     *   apiUrl by replacing port 3031 with 26657.
     */
    constructor(apiUrl: string, auth: WillowAuth, privateKey: string, publicKeyId: string, consensusRpcUrl?: string);
    /**
     * Get the encrypted key grant for the authenticated DID.
     *
     * Calls GET /key-grants/:subgrove_id/:did where the DID is
     * the caller's own DID from the auth instance.
     *
     *
     * @param subgroveId - Subgrove ID
     * @returns The encrypted key grant for the caller's DID
     * @throws {WillowError} if no identity is set or the grant is not found
     */
    getMyKeyGrant(subgroveId: string): Promise<EncryptedKeyGrant>;
    /**
     * List all grantee DIDs for a subgrove.
     *
     * Calls GET /key-grants/:subgrove_id.
     * Requires the caller to be the subgrove owner or admin.
     *
     *
     * @param subgroveId - Subgrove ID
     * @returns Array of grantee DIDs
     */
    listKeyGrantees(subgroveId: string): Promise<string[]>;
    /**
     * Get a GroveDB Merkle proof for a key grant.
     *
     * Calls GET /proof/key-grant/:subgrove_id/:did.
     * This endpoint is public (proofs are non-sensitive).
     *
     *
     * @param subgroveId - Subgrove ID
     * @param did - DID of the grantee
     * @returns Proof response with hex-encoded Merkle proof
     */
    getKeyGrantProof(subgroveId: string, did: string): Promise<KeyGrantProofResponse>;
    /**
     * Grant a subgrove encryption key to a DID.
     *
     * Builds a GrantSubgroveKey transaction, signs it with Ed25519, and
     * broadcasts to the CometBFT consensus layer.
     *
     *
     * @param subgroveId - Subgrove ID
     * @param grant - The encrypted key grant for the grantee
     * @returns Broadcast result with transaction hash
     */
    grantSubgroveKey(subgroveId: string, grant: EncryptedKeyGrant): Promise<BroadcastResult>;
    /**
     * Revoke a subgrove encryption key from a DID.
     *
     * Builds a RevokeSubgroveKey transaction, signs it with Ed25519, and
     * broadcasts to the CometBFT consensus layer.
     *
     *
     * @param subgroveId - Subgrove ID
     * @param revokeDid - DID to revoke access from
     * @returns Broadcast result with transaction hash
     */
    revokeSubgroveKey(subgroveId: string, revokeDid: string): Promise<BroadcastResult>;
    /**
     * Rotate the subgrove encryption key and re-grant to authorized DIDs.
     *
     * Builds a RotateSubgroveKey transaction, signs it with Ed25519, and
     * broadcasts to the CometBFT consensus layer.
     *
     * Only the subgrove owner can rotate keys. The new epoch must be
     * exactly current_epoch + 1. All existing grants are deleted and
     * replaced with the provided new grants.
     *
     *
     * @param subgroveId - Subgrove ID
     * @param newEpoch - New key epoch (must be current_epoch + 1)
     * @param newGrants - New encrypted key grants for all authorized DIDs
     * @returns Broadcast result with transaction hash
     */
    rotateSubgroveKey(subgroveId: string, newEpoch: number, newGrants: EncryptedKeyGrant[]): Promise<BroadcastResult>;
    /**
     * Require a DID from the auth instance, throwing if not set.
     */
    private requireDid;
    /**
     * Get the next nonce for a DID from the REST API.
     * Propagates errors instead of silently falling back to nonce 1,
     * which could cause transaction replay or rejection.
     */
    private getNextNonce;
    /**
     * Broadcast a wrapped transaction to CometBFT via JSON-RPC broadcast_tx_sync.
     */
    private broadcastTransaction;
}

/**
 * ERC-8004 (Trustless Agents) integration for Willow.
 *
 * Provides helpers to link Ethereum addresses to Willow DIDs and interact
 * with on-chain ERC-8004 agent registrations.
 */
interface LinkEthAddressTx {
    did: string;
    ethAddress: string;
    publicKeyId: string;
    signature?: string;
    nonce?: number;
}
interface RegisterErc8004AgentTx {
    did: string;
    chainId: number;
    registryAddress: string;
    agentId: number;
    agentUri: string;
    signature?: string;
    publicKeyId?: string;
    nonce?: number;
}
interface AgentReputationSummary {
    checkpoint_success_rate: number;
    verification_accuracy: number;
    active_days: number;
    last_updated: number;
}
interface AgentRegistrationJson {
    type: string;
    name: string;
    description: string;
    services: AgentService[];
    x402_support: boolean;
    active: boolean;
    registrations: AgentChainRegistration[];
    supported_trust: string[];
    reputation?: AgentReputationSummary;
}
interface ReputationAttestation {
    did: string;
    metrics: Record<string, unknown>;
    proof: string;
    block_height: number;
    last_updated: number;
}
interface ReputationHistoryEvent {
    event_type: string;
    block_height: number;
    timestamp: number;
    reference: string | null;
}
interface ReputationHistoryResponse {
    did: string;
    events: ReputationHistoryEvent[];
    total_events: number;
}
interface AgentService {
    name: string;
    endpoint: string;
}
interface AgentChainRegistration {
    chain_id: number;
    registry: string;
    agent_id: number;
}
interface Erc8004Registration {
    chain_id: number;
    registry_address: number[];
    agent_id: number;
    agent_uri: string;
    registered_at: number;
}
interface Erc8004ValidationRecord {
    request_hash: string;
    subgrove_id: string;
    block_range: [number, number];
    state_root: string;
    response: number;
    status: string;
    tee_verified: boolean;
    tee_type: string | null;
    submitted_at_block: number;
    challenge_deadline: number | null;
    tag: string;
}
interface Erc8004ValidationStatusResponse {
    did: string;
    validations: Erc8004ValidationRecord[];
    total: number;
}
interface ValidationStatusBreakdown {
    trusted: number;
    pending_challenge: number;
    tee_attested: number;
    disputed: number;
    invalidated: number;
}
interface DisputeStats {
    disputes_won_as_defendant: number;
    disputes_lost_as_defendant: number;
    disputes_won_as_challenger: number;
    disputes_lost_as_challenger: number;
}
interface Erc8004ValidationSummary {
    did: string;
    count: number;
    average_response: number;
    status_breakdown: ValidationStatusBreakdown;
    dispute_stats: DisputeStats;
}
interface Erc8004AgentListItem {
    did: string;
    eth_address: string | null;
    agent_uri: string;
    chain_id: number;
    agent_id: number;
    validation_count: number;
    registered_at: number;
}
interface Erc8004AgentListResponse {
    agents: Erc8004AgentListItem[];
    total: number;
    offset: number;
    limit: number;
}
declare class Erc8004Client {
    private apiUrl;
    constructor(apiUrl: string);
    /** List/search ERC-8004 registered agents with optional filters. */
    listAgents(options?: {
        limit?: number;
        offset?: number;
    }): Promise<Erc8004AgentListResponse>;
    /** Fetch the ERC-8004 registration JSON for an agent DID. */
    getAgentRegistration(did: string): Promise<AgentRegistrationJson>;
    /** Get the ETH address linked to a DID. */
    getEthAddress(did: string): Promise<string | null>;
    /** Get the DID linked to an ETH address. */
    getDidForEth(ethAddress: string): Promise<string | null>;
    /** Get stored ERC-8004 registration details for a DID. */
    getErc8004Details(did: string): Promise<Erc8004Registration | null>;
    /** Fetch reputation attestation with GroveDB Merkle proof for a DID. */
    getReputationAttestation(did: string): Promise<ReputationAttestation>;
    /** Fetch ERC-8004 formatted reputation history for a DID. */
    getReputationHistory(did: string, limit?: number): Promise<ReputationHistoryResponse>;
    /** Fetch ERC-8004 validation status (checkpoint validations) for a DID. */
    getValidationStatus(did: string, limit?: number, subgroveId?: string): Promise<Erc8004ValidationStatusResponse>;
    /** Fetch aggregated ERC-8004 validation summary for a DID. */
    getValidationSummary(did: string, subgroveId?: string): Promise<Erc8004ValidationSummary>;
}

/**
 * Codec + fetch helpers for the per-(vault, day) ERC-4626 flow aggregate
 * sidecar persisted by `willow-indexer-node` for the `vault-daily-stats`
 * template. Pairs with the indexer's
 * `GET /verifiable-rpc-range/:subgrove_id/:from_key_hex/:to_key_hex`
 * endpoint, which returns raw `(key, value)` byte pairs alongside a
 * GroveDB inclusion proof + the latest GKR proof.
 *
 * The sidecar key + value layouts are pinned by
 * `crates/indexer-node/src/vault_daily_stats_sidecar.rs`. Browser-safe:
 * uses `Uint8Array` and `bigint` only.
 *
 * # Trust model
 *
 * The aggregate value isn't directly bound by the GKR `output_root` for
 * the day — each per-block proof commits to per-block totals, and the
 * sidecar sums them locally. To verify a day's value cryptographically,
 * fetch every per-block proof in the day's block range and re-run the
 * sum. See issue #311 for the long-term cryptographic-binding paths.
 */
/** Length in bytes of a (vault, day) key: `vds:` + 20-byte address + 8-byte day_id. */
declare const VAULT_DAILY_STATS_KEY_LEN = 32;
/** Length in bytes of an encoded `DayAggregate` value. */
declare const VAULT_DAILY_STATS_VALUE_LEN = 56;
/** Seconds per UTC day — matches the sidecar's `day_id_from_timestamp`. */
declare const SECONDS_PER_DAY = 86400n;
/**
 * Decoded per-(vault, day) aggregate. `totalIn`, `totalOut`, and `maxIn`
 * are u128 (bigint); counts fit in u32 (regular `number`).
 */
interface DayAggregate {
    /** Deposit event count for this (vault, day). */
    depositCount: number;
    /** Withdraw event count. */
    withdrawCount: number;
    /** Sum of `assets` over all matching deposits. */
    totalIn: bigint;
    /** Sum of `assets` over all matching withdraws. */
    totalOut: bigint;
    /** Largest single deposit's `assets` over this (vault, day). */
    maxIn: bigint;
}
/**
 * UTC day index from a unix-second timestamp. Matches
 * `vault_daily_stats_sidecar::day_id_from_timestamp`. Day boundaries
 * fall on UTC midnight, so monthly retros line up with calendar dates.
 */
declare function dayIdFromTimestamp(unixSecs: bigint | number): bigint;
/** Convenience: UTC day index from a JS `Date`. */
declare function dayIdFromDate(date: Date): bigint;
/**
 * Encode a `(vault, day_id)` lookup key.
 *
 * @param vault - 20-byte EVM address
 * @param dayId - UTC day index (e.g. from {@link dayIdFromTimestamp})
 */
declare function encodeVaultDailyStatsKey(vault: Uint8Array, dayId: bigint): Uint8Array;
/** Inverse of {@link encodeVaultDailyStatsKey}. Throws on malformed input. */
declare function decodeVaultDailyStatsKey(bytes: Uint8Array): {
    vault: Uint8Array;
    dayId: bigint;
};
/** Decode a 56-byte value into a `DayAggregate`. Throws on wrong length. */
declare function decodeDayAggregate(bytes: Uint8Array): DayAggregate;
/** Encode a `DayAggregate` into the wire byte layout. Inverse of {@link decodeDayAggregate}. */
declare function encodeDayAggregate(agg: DayAggregate): Uint8Array;
/** One row from the verifiable-rpc-range endpoint with its decoded form. */
interface VaultDailyStatsRow {
    /** Vault address from the row's key. */
    vault: Uint8Array;
    /** UTC day index from the row's key. */
    dayId: bigint;
    /** Decoded value. */
    aggregate: DayAggregate;
    /** Raw key bytes (32) — exactly what the server returned. */
    rawKey: Uint8Array;
    /** Raw value bytes (56) — exactly what the server returned. */
    rawValue: Uint8Array;
}
/**
 * Decode a `verifiable-rpc-range` response's `rows: [{key, value}]` list
 * into typed rows. Skips rows whose value isn't 56 bytes (server returns
 * empty `value` for non-Item GroveDB elements that happen to fall in the
 * range — those aren't aggregate entries).
 *
 * Caller is still responsible for verifying the GroveDB inclusion proof
 * and the GKR proofs the response carries.
 */
declare function decodeVaultDailyStatsRows(rows: ReadonlyArray<{
    key: ArrayLike<number> | Uint8Array;
    value: ArrayLike<number> | Uint8Array;
}>): VaultDailyStatsRow[];
/**
 * Build the inclusive `[fromDayId, toDayId]` byte-key range for one
 * vault. Pass these to `verifiable-rpc-range` as `from_key_hex` /
 * `to_key_hex`.
 */
declare function vaultDayRangeKeys(vault: Uint8Array, fromDayId: bigint, toDayId: bigint): {
    fromKey: Uint8Array;
    toKey: Uint8Array;
};

declare const VERSION = "0.1.0";
/**
 * Pre-funded test account for local devnet development.
 *
 * This account is pre-registered and funded in the devnet genesis.
 * Use it for SDK testing and development - DO NOT use in production!
 *
 * @example
 * ```typescript
 * import { WillowClient, DEVNET_TEST_ACCOUNT } from '@willow/sdk';
 *
 * const client = new WillowClient({ apiUrl: 'http://localhost:3031' });
 * client.auth.setIdentity(
 *   DEVNET_TEST_ACCOUNT.did,
 *   DEVNET_TEST_ACCOUNT.privateKey,
 *   DEVNET_TEST_ACCOUNT.publicKeyId
 * );
 * ```
 */
declare const DEVNET_TEST_ACCOUNT: {
    /** DID of the test account */
    readonly did: "did:willow:devnet-test";
    /** Private key (hex) - DO NOT USE IN PRODUCTION */
    readonly privateKey: "b5ecc03536f5e039e3c5bc46ad178d7faf80cee5f063016a4f4084e163409b3c";
    /** Public key (hex) */
    readonly publicKey: "c153874d3d284a11e3cb12b524e1a9cc32fef966d56b903c79688a95d5193c8f";
    /** Key ID for authentication */
    readonly publicKeyId: "did:willow:devnet-test#key-1";
};

export { type AccountState, type AgentChainRegistration, type AgentRegistrationJson, type AgentReputationSummary, type AgentService, type ApiIndexerInfo, type ApiResponse, type Balance, type BroadcastResult, type ChainFamily, type CheckpointInfo, CommitmentFrequency, type ComputeFunction, type ComputedFieldDefinition, ComputedFieldRegistry, type ComputedFieldSet, ConsensusClient, type ConsensusConfig, ConsensusConfigBuilder, DEVNET_TEST_ACCOUNT, type DataRecord, type DataSource, type DataStoreTx, type DatasetRegistration, type DayAggregate, type DidDocument, type DisputeStats, type EncryptedKeyGrant, type Erc8004AgentListItem, type Erc8004AgentListResponse, Erc8004Client, type Erc8004Registration, type Erc8004ValidationRecord, type Erc8004ValidationStatusResponse, type Erc8004ValidationSummary, type EthCallRequestBody, EthOperations, type EthStateRequest, type EthVerifiableRpcResponse, type EthereumAnchor, type EvmDataSource, type FieldType, type FileEncryption, type FileListResponse, type FileManifest, FileOperations, GENERIC_AMM_PAIR_FIELDS, type GraphQLQueryOptions, type GraphQLQueryResult, GroveDBProofVerifier, type GroveDBQueryProof, type Header, HeaderVerifier, type HistoricalQueryRequest, type HistoricalQueryResponse, type IndexDefinition, type KeyGrantProofResponse, LENDING_PROTOCOL_FIELDS, LP_SHARE_FIELDS, type LightBlock, LightClient, type LightClientConfig, LightClientConfigBuilder, type LinkEthAddressTx, MANIFEST_SPEC_VERSION, ManifestValidationError, type MerkleProof, type MptProof, NoIndexersReachableError, type PrivacyConfig, PrivacyOperations, type ProofResponse, type ProofVerificationOptions, type ProofVerificationResult, ProofVerifier, type PublicKey, type QueryFilter, type QueryProof, type QueryRequest, type QueryResponse, type QueryResponseExt, type QuerySearch, type QuerySort, type QuerySource, type RegisterDatasetRequest, type RegisterDidTx, type RegisterErc8004AgentTx, type RegisterSubgroveTx, type ReputationAttestation, type ReputationHistoryEvent, type ReputationHistoryResponse, type RoutedQueryResult, SECONDS_PER_DAY, SUPPORTED_CHAINS, type SchemaDefinition, type SignatureAlgorithm, type SqlQueryOptions, type SqlQueryRequest, type SqlQueryResponse, type SqlQueryResult, type StateProof, StateVerifyMode, type StorageSlotProof, type SubscribeOptions, type SubscribeSource, type SupportedChain, type TokenInfo, type Transaction, TransactionStatus, type TransferRequest, type TransferTx, type TrustThreshold, type TrustedHeader, UNISWAP_V2_AGGREGATION_FIELDS, UNISWAP_V2_PAIR_FIELDS, UNISWAP_V2_TOKEN_FIELDS, type UnsubscribeFn, VAULT_DAILY_STATS_KEY_LEN, VAULT_DAILY_STATS_VALUE_LEN, VERSION, type ValidationStatusBreakdown, type Validator, ValidatorHasNoDataError, type ValidatorSet, type VaultDailyStatsRow, type VerificationResult, type VerifiedCall, type VerifiedStateRead, type VerifiedStorage, WillowAuth, WillowClient, type WillowConfig, WillowData, WillowError, WillowIndexers, type WillowIndexersOptions, type WillowManifest, WillowSubscriptions, applyComputedFields, applyComputedFieldsToResponse, chainFamily, chunk, configureProofVerification, localConfig as consensusLocalConfig, mainnetConfig$1 as consensusMainnetConfig, testnetConfig as consensusTestnetConfig, createDidFromWallet, dayIdFromDate, dayIdFromTimestamp, decodeDayAggregate, decodeVaultDailyStatsKey, decodeVaultDailyStatsRows, decryptFile, detectAlgorithm, effectiveQueryEndpoint, encodeDayAggregate, encodeVaultDailyStatsKey, encryptFile, evmChainId, extendQueryResponse, extractRootHashFromProof, fromEvmChainId, generateEd25519KeyPair, generateId, generateWallet, getEd25519PublicKey, getPublicKeyFromDid, globalComputedFieldRegistry, index$1 as grovedb, isSupportedChain, isValidDid, fastSyncConfig as lightClientFastSyncConfig, mainnetConfig as lightClientMainnetConfig, testConfig as lightClientTestConfig, index as manifest, parseManifest, retry, serializeManifest, signEd25519, sleep, validateManifest, vaultDayRangeKeys, verifyEd25519, verifyItemProof, verifyMptProof, verifyProofAdvanced, verifyQueryProof, verifyQueryResponse, verifyStateProof };
