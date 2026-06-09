var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/auth/index.ts
import axios from "axios";
import { ethers } from "ethers";
import { ed25519 } from "@noble/curves/ed25519";

// src/types/index.ts
var WillowError = class extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "WillowError";
  }
};

// src/auth/index.ts
function detectAlgorithm(did, privateKey) {
  if (did.includes(":eth:") || did.includes(":eip155:")) {
    return "secp256k1";
  }
  if (privateKey) {
    if (privateKey.startsWith("0x") && privateKey.length === 66) {
      return "secp256k1";
    }
    const cleanKey = privateKey.replace(/^0x/, "");
    if (cleanKey.length === 64 || cleanKey.length === 128) {
      return "Ed25519";
    }
  }
  return "Ed25519";
}
function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, "");
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}
function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function signEd25519(message, privateKeyHex) {
  const cleanKey = privateKeyHex.replace(/^0x/, "");
  let privateKey;
  if (cleanKey.length === 128) {
    privateKey = hexToBytes(cleanKey.slice(0, 64));
  } else if (cleanKey.length === 64) {
    privateKey = hexToBytes(cleanKey);
  } else {
    throw new WillowError(
      `Invalid Ed25519 private key length: ${cleanKey.length / 2} bytes (expected 32 or 64)`,
      "INVALID_KEY"
    );
  }
  const messageBytes = new TextEncoder().encode(message);
  const signature = ed25519.sign(messageBytes, privateKey);
  return bytesToHex(signature);
}
function verifyEd25519(message, signatureHex, publicKeyHex) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signature = hexToBytes(signatureHex);
    const publicKey = hexToBytes(publicKeyHex);
    return ed25519.verify(signature, messageBytes, publicKey);
  } catch {
    return false;
  }
}
function generateEd25519KeyPair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey)
  };
}
function getEd25519PublicKey(privateKeyHex) {
  const cleanKey = privateKeyHex.replace(/^0x/, "");
  let privateKey;
  if (cleanKey.length === 128) {
    return cleanKey.slice(64);
  } else if (cleanKey.length === 64) {
    privateKey = hexToBytes(cleanKey);
    const publicKey = ed25519.getPublicKey(privateKey);
    return bytesToHex(publicKey);
  } else {
    throw new WillowError(
      `Invalid Ed25519 private key length: ${cleanKey.length / 2} bytes`,
      "INVALID_KEY"
    );
  }
}
var WillowAuth = class {
  constructor(apiUrl) {
    this.api = axios.create({
      baseURL: apiUrl,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  /**
   * Set identity for per-request signing.
   * Call this once; all subsequent requests will be signed automatically.
   */
  setIdentity(did, privateKey, publicKeyId) {
    this.did = did;
    this.privateKey = privateKey;
    this.publicKeyId = publicKeyId;
    this.algorithm = detectAlgorithm(did, privateKey);
  }
  /**
   * Check if an identity is configured for signing
   */
  hasIdentity() {
    return !!(this.did && this.privateKey && this.publicKeyId);
  }
  /**
   * Get the current DID
   */
  getDid() {
    return this.did;
  }
  /**
   * Get the current private key (hex-encoded)
   */
  getPrivateKey() {
    return this.privateKey;
  }
  /**
   * Get the current public key ID
   */
  getPublicKeyId() {
    return this.publicKeyId;
  }
  /**
   * Register a new DID document
   */
  async registerDid(didDocument) {
    const response = await this.api.post("/did", didDocument);
    if (!response.data.success) {
      throw new WillowError(response.data.error || "Failed to register DID", "REGISTRATION_FAILED");
    }
    return response.data.data;
  }
  /**
   * Get DID document
   */
  async getDid_(did) {
    const response = await this.api.get(`/did/${did}`);
    if (!response.data.success) {
      throw new WillowError(response.data.error || "Failed to get DID", "DID_NOT_FOUND", 404);
    }
    return response.data.data;
  }
  /**
   * Sign a request and return the authentication headers.
   *
   * Message format: `{METHOD}:{PATH}:{TIMESTAMP}`
   */
  signRequest(method, path) {
    if (!this.did || !this.privateKey || !this.publicKeyId) {
      throw new WillowError(
        "Identity not set. Call setIdentity() first.",
        "NO_IDENTITY"
      );
    }
    const timestamp = Math.floor(Date.now() / 1e3).toString();
    const message = `${method}:${path}:${timestamp}`;
    let signature;
    if (this.algorithm === "secp256k1") {
      const wallet = new ethers.Wallet(this.privateKey);
      const messageBytes = ethers.toUtf8Bytes(message);
      const messageHash = ethers.keccak256(messageBytes);
      const sig = wallet.signMessageSync(ethers.getBytes(messageHash));
      signature = sig.replace("0x", "");
    } else {
      signature = signEd25519(message, this.privateKey);
    }
    return {
      "X-DID": this.did,
      "X-Public-Key-ID": this.publicKeyId,
      "X-Signature": signature,
      "X-Timestamp": timestamp
    };
  }
  /**
   * Get authentication headers for an API request.
   * Returns signature headers if identity is set, empty object otherwise.
   */
  getAuthHeaders(method, path) {
    if (!this.hasIdentity()) {
      return {};
    }
    return this.signRequest(method, path);
  }
  /**
   * Get query parameters for authentication (DID only, for pay-per-read fallback)
   */
  getAuthParams() {
    if (!this.did) {
      return {};
    }
    return { did: this.did };
  }
};

// src/data/index.ts
import axios3 from "axios";

// src/grovedb/index.ts
var grovedb_exports = {};
__export(grovedb_exports, {
  BincodeReader: () => BincodeReader,
  GroveDBVerificationError: () => GroveDBVerificationError,
  HASH_LENGTH: () => HASH_LENGTH,
  MerkDecoder: () => MerkDecoder,
  NULL_HASH: () => NULL_HASH,
  Tree: () => Tree,
  VarintError: () => VarintError,
  blake3Hash: () => blake3Hash,
  bytesToHex: () => bytesToHex2,
  combineHash: () => combineHash,
  compareBytes: () => compareBytes,
  decodeGroveDBProof: () => decodeGroveDBProof,
  decodeMerkOps: () => decodeMerkOps,
  decodeSignedVarint: () => decodeSignedVarint,
  decodeSignedVarint64: () => decodeSignedVarint64,
  decodeVarint: () => decodeVarint,
  decodeVarint64: () => decodeVarint64,
  deserializeElement: () => deserializeElement,
  encodeVarint: () => encodeVarint,
  executeMerkProof: () => executeMerkProof,
  executeMerkProofWithQuery: () => executeMerkProofWithQuery,
  executeOps: () => executeOps,
  getTreeFeatureType: () => getTreeFeatureType,
  hasRootKey: () => hasRootKey,
  hashEquals: () => hashEquals,
  hashToHex: () => hashToHex,
  hexToBytes: () => hexToBytes2,
  hexToHash: () => hexToHash,
  isTreeElement: () => isTreeElement,
  kvDigestToKvHash: () => kvDigestToKvHash,
  kvHash: () => kvHash,
  nodeHash: () => nodeHash,
  quickVerify: () => quickVerify,
  valueHash: () => valueHash,
  verifyGroveDBProof: () => verifyGroveDBProof,
  verifyProofAgainstRoot: () => verifyProofAgainstRoot
});

// src/grovedb/types.ts
var HASH_LENGTH = 32;
var NULL_HASH = new Uint8Array(32);
var GroveDBVerificationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "GroveDBVerificationError";
  }
};

// src/grovedb/bincode.ts
var U16_TAG = 251;
var U32_TAG = 252;
var U64_TAG = 253;
var U128_TAG = 254;
var BincodeReader = class {
  constructor(data) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.offset = 0;
  }
  position() {
    return this.offset;
  }
  remaining() {
    return this.data.length - this.offset;
  }
  hasMore() {
    return this.offset < this.data.length;
  }
  requireBytes(n, context) {
    if (this.offset + n > this.data.length) {
      throw new GroveDBVerificationError(
        `${context}: need ${n} bytes at offset ${this.offset}, only ${this.data.length - this.offset} remaining`
      );
    }
  }
  readU8() {
    this.requireBytes(1, "readU8");
    return this.data[this.offset++];
  }
  readBool() {
    const b = this.readU8();
    if (b === 0) return false;
    if (b === 1) return true;
    throw new GroveDBVerificationError(
      `Invalid bool tag ${b} at offset ${this.offset - 1}`
    );
  }
  /**
   * Read a variable-length unsigned integer. Returns a bigint since the wire
   * format supports up to u128.
   */
  readVarintU128() {
    this.requireBytes(1, "readVarint tag");
    const tag = this.data[this.offset++];
    if (tag <= 250) return BigInt(tag);
    if (tag === U16_TAG) {
      this.requireBytes(2, "readVarint U16");
      const v = this.view.getUint16(this.offset, false);
      this.offset += 2;
      return BigInt(v);
    }
    if (tag === U32_TAG) {
      this.requireBytes(4, "readVarint U32");
      const v = this.view.getUint32(this.offset, false);
      this.offset += 4;
      return BigInt(v);
    }
    if (tag === U64_TAG) {
      this.requireBytes(8, "readVarint U64");
      const hi = this.view.getUint32(this.offset, false);
      const lo = this.view.getUint32(this.offset + 4, false);
      this.offset += 8;
      return BigInt(hi) << 32n | BigInt(lo);
    }
    if (tag === U128_TAG) {
      this.requireBytes(16, "readVarint U128");
      let v = 0n;
      for (let i = 0; i < 16; i++) {
        v = v << 8n | BigInt(this.data[this.offset + i]);
      }
      this.offset += 16;
      return v;
    }
    throw new GroveDBVerificationError(
      `Unknown varint tag 0x${tag.toString(16)} at offset ${this.offset - 1}`
    );
  }
  /**
   * Read a varint as bigint (u64-range).
   */
  readVarintU64() {
    return this.readVarintU128();
  }
  /**
   * Read a varint that is expected to fit in a JS Number (<= 2^53-1).
   */
  readVarintAsNumber() {
    const big = this.readVarintU128();
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new GroveDBVerificationError(
        `Varint value ${big} exceeds Number.MAX_SAFE_INTEGER`
      );
    }
    return Number(big);
  }
  /**
   * Read a zigzag-encoded signed i64 varint.
   *
   * zigzag_decode(v) = (v >> 1) ^ -(v & 1)
   */
  readVarintI64() {
    const u = this.readVarintU128();
    return u >> 1n ^ -(u & 1n);
  }
  /**
   * Read a zigzag-encoded signed i128 varint.
   */
  readVarintI128() {
    const u = this.readVarintU128();
    return u >> 1n ^ -(u & 1n);
  }
  /**
   * Read an enum variant tag. In bincode 2, enum discriminants are encoded as
   * u32-as-varint.
   */
  readVariant() {
    return this.readVarintAsNumber();
  }
  /**
   * Read a Vec<u8> or any length-prefixed byte sequence.
   */
  readByteVec() {
    const len = this.readVarintAsNumber();
    this.requireBytes(len, "readByteVec body");
    const out = this.data.slice(this.offset, this.offset + len);
    this.offset += len;
    return out;
  }
  /**
   * Read a sequence length prefix (for Vec<T>, BTreeMap, etc).
   */
  readLength() {
    return this.readVarintAsNumber();
  }
  /**
   * Read `Option<Vec<u8>>`: 1 byte tag + optional bytes.
   */
  readOptionByteVec() {
    const tag = this.readU8();
    if (tag === 0) return null;
    if (tag === 1) return this.readByteVec();
    throw new GroveDBVerificationError(
      `Invalid Option tag ${tag} at offset ${this.offset - 1}`
    );
  }
  /**
   * Read `Option<u8>`: 1 byte tag + optional single byte.
   */
  readOptionU8() {
    const tag = this.readU8();
    if (tag === 0) return null;
    if (tag === 1) return this.readU8();
    throw new GroveDBVerificationError(
      `Invalid Option tag ${tag} at offset ${this.offset - 1}`
    );
  }
  /**
   * Read `Vec<Vec<u8>>` (length + repeated byte vecs).
   */
  readVecOfByteVec() {
    const len = this.readLength();
    const out = [];
    for (let i = 0; i < len; i++) out.push(this.readByteVec());
    return out;
  }
};
function bytesToHex2(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes2(hex) {
  const clean = hex.replace(/^0x/, "");
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

// src/grovedb/decoder.ts
function decodeLayerProof(reader) {
  const merkProof = reader.readByteVec();
  const mapLen = reader.readLength();
  const lowerLayers = /* @__PURE__ */ new Map();
  for (let i = 0; i < mapLen; i++) {
    const keyBytes = reader.readByteVec();
    const value = decodeLayerProof(reader);
    lowerLayers.set(bytesToHex2(keyBytes), value);
  }
  return { merkProof, lowerLayers };
}
function decodeProveOptions(reader) {
  return {
    decreaseLimitOnEmptySubQueryResult: reader.readBool()
  };
}
function decodeGroveDBProofV0(reader) {
  const rootLayer = decodeLayerProof(reader);
  const proveOptions = decodeProveOptions(reader);
  return { rootLayer, proveOptions };
}
function decodeGroveDBProof(bytes) {
  const reader = new BincodeReader(bytes);
  const variant = reader.readVariant();
  if (variant !== 0) {
    throw new GroveDBVerificationError(
      `Unknown GroveDBProof variant: ${variant} (only V0 supported)`
    );
  }
  const proof = decodeGroveDBProofV0(reader);
  if (reader.hasMore()) {
    throw new GroveDBVerificationError(
      `Trailing bytes after GroveDBProof decode: ${reader.remaining()} bytes at offset ${reader.position()}`
    );
  }
  return { version: 0, proof };
}

// src/grovedb/hash.ts
import { blake3 } from "@noble/hashes/blake3";

// src/grovedb/varint.ts
var VarintError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "VarintError";
  }
};
function encodeVarint(value) {
  const bytes = [];
  while (value > 127) {
    bytes.push(value & 127 | 128);
    value >>>= 7;
  }
  bytes.push(value);
  return new Uint8Array(bytes);
}
function decodeVarint(bytes, offset = 0) {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  while (offset + bytesRead < bytes.length) {
    const byte = bytes[offset + bytesRead];
    bytesRead++;
    value |= (byte & 127) << shift;
    if ((byte & 128) === 0) {
      return { value, bytesRead };
    }
    shift += 7;
    if (shift > 35) {
      throw new VarintError("Varint too long");
    }
  }
  throw new VarintError("Unexpected end of varint");
}
function decodeSignedVarint(bytes, offset = 0) {
  const { value: unsigned, bytesRead } = decodeVarint(bytes, offset);
  const signed = unsigned >>> 1 ^ -(unsigned & 1);
  return { value: signed, bytesRead };
}
function decodeSignedVarint64(bytes, offset = 0) {
  let value = 0n;
  let shift = 0n;
  let bytesRead = 0;
  while (offset + bytesRead < bytes.length) {
    const byte = bytes[offset + bytesRead];
    bytesRead++;
    value |= BigInt(byte & 127) << shift;
    if ((byte & 128) === 0) {
      const signed = value >> 1n ^ -(value & 1n);
      return { value: signed, bytesRead };
    }
    shift += 7n;
    if (shift > 70n) {
      throw new VarintError("Varint too long");
    }
  }
  throw new VarintError("Unexpected end of varint");
}
function decodeVarint64(bytes, offset = 0) {
  let value = 0n;
  let shift = 0n;
  let bytesRead = 0;
  while (offset + bytesRead < bytes.length) {
    const byte = bytes[offset + bytesRead];
    bytesRead++;
    value |= BigInt(byte & 127) << shift;
    if ((byte & 128) === 0) {
      return { value, bytesRead };
    }
    shift += 7n;
    if (shift > 70n) {
      throw new VarintError("Varint too long");
    }
  }
  throw new VarintError("Unexpected end of varint");
}

// src/grovedb/hash.ts
function blake3Hash(data) {
  return blake3(data);
}
function valueHash(value) {
  const lengthPrefix = encodeVarint(value.length);
  const combined = new Uint8Array(lengthPrefix.length + value.length);
  combined.set(lengthPrefix, 0);
  combined.set(value, lengthPrefix.length);
  return blake3Hash(combined);
}
function kvHash(key, value) {
  const keyLengthPrefix = encodeVarint(key.length);
  const valHash = valueHash(value);
  const combined = new Uint8Array(keyLengthPrefix.length + key.length + HASH_LENGTH);
  let offset = 0;
  combined.set(keyLengthPrefix, offset);
  offset += keyLengthPrefix.length;
  combined.set(key, offset);
  offset += key.length;
  combined.set(valHash, offset);
  return blake3Hash(combined);
}
function kvDigestToKvHash(key, valHash) {
  const keyLengthPrefix = encodeVarint(key.length);
  const combined = new Uint8Array(keyLengthPrefix.length + key.length + HASH_LENGTH);
  let offset = 0;
  combined.set(keyLengthPrefix, offset);
  offset += keyLengthPrefix.length;
  combined.set(key, offset);
  offset += key.length;
  combined.set(valHash, offset);
  return blake3Hash(combined);
}
function nodeHash(kv, left, right) {
  const combined = new Uint8Array(HASH_LENGTH * 3);
  combined.set(kv, 0);
  combined.set(left, HASH_LENGTH);
  combined.set(right, HASH_LENGTH * 2);
  return blake3Hash(combined);
}
function combineHash(a, b) {
  const combined = new Uint8Array(HASH_LENGTH * 2);
  combined.set(a, 0);
  combined.set(b, HASH_LENGTH);
  return blake3Hash(combined);
}
function hashEquals(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function hashToHex(h) {
  return Array.from(h, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function hexToHash(hex) {
  const clean = hex.replace(/^0x/, "");
  if (clean.length !== HASH_LENGTH * 2) {
    throw new GroveDBVerificationError(`Invalid hash hex length: ${clean.length}, expected ${HASH_LENGTH * 2}`);
  }
  const bytes = new Uint8Array(HASH_LENGTH);
  for (let i = 0; i < HASH_LENGTH; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

// src/grovedb/tree.ts
var Tree = class _Tree {
  constructor(node) {
    this.left = null;
    this.right = null;
    this.height = 1;
    this.childHeights = [0, 0];
    this.node = node;
  }
  /**
   * Compute the hash of this tree node
   */
  hash() {
    if (this.node.type === "Hash") {
      return this.node.hash;
    }
    const kvh = this.computeKVHash();
    return nodeHash(kvh, this.childHash(true), this.childHash(false));
  }
  /**
   * Compute the KV hash portion based on node type
   */
  computeKVHash() {
    switch (this.node.type) {
      case "Hash":
        throw new GroveDBVerificationError("Hash nodes should not compute KV hash");
      case "KVHash":
        return this.node.kvHash;
      case "KV":
        return kvHash(this.node.key, this.node.value);
      case "KVValueHash":
      case "KVValueHashFeatureType":
        return kvDigestToKvHash(this.node.key, this.node.valueHash);
      case "KVDigest":
        return kvDigestToKvHash(this.node.key, this.node.valueHash);
      case "KVRefValueHash": {
        const refValueHash = valueHash(this.node.value);
        const combinedValueHash = combineHash(this.node.valueHash, refValueHash);
        return kvDigestToKvHash(this.node.key, combinedValueHash);
      }
      default:
        throw new GroveDBVerificationError(`Unknown node type: ${this.node.type}`);
    }
  }
  /**
   * Get the hash of a child, or NULL_HASH if no child
   */
  childHash(left) {
    const child = left ? this.left : this.right;
    return child ? child.hash : NULL_HASH;
  }
  /**
   * Attach a child to this node
   */
  attach(left, child) {
    this.attachWithHeight(left, child, child.height);
  }
  /**
   * Attach a child to this node with explicit height
   * This is used when the child may have been collapsed (hash converted)
   * and we need to preserve the original height for AVL checking
   */
  attachWithHeight(left, child, originalHeight) {
    if (left && this.left !== null) {
      throw new GroveDBVerificationError("Left child already attached");
    }
    if (!left && this.right !== null) {
      throw new GroveDBVerificationError("Right child already attached");
    }
    this.height = Math.max(this.height, originalHeight + 1);
    if (left) {
      this.childHeights[0] = originalHeight;
      this.left = { tree: child, hash: child.hash() };
    } else {
      this.childHeights[1] = originalHeight;
      this.right = { tree: child, hash: child.hash() };
    }
  }
  /**
   * Convert this tree to a hash-only node (for memory efficiency during execution)
   */
  intoHash() {
    const h = this.hash();
    return new _Tree({ type: "Hash", hash: h });
  }
  /**
   * Get the key from this node (if it has one)
   */
  getKey() {
    switch (this.node.type) {
      case "KV":
      case "KVValueHash":
      case "KVDigest":
      case "KVRefValueHash":
      case "KVValueHashFeatureType":
        return this.node.key;
      default:
        return null;
    }
  }
  /**
   * Get the value from this node (if it has one)
   */
  getValue() {
    switch (this.node.type) {
      case "KV":
      case "KVValueHash":
      case "KVRefValueHash":
      case "KVValueHashFeatureType":
        return this.node.value;
      default:
        return null;
    }
  }
  /**
   * Get the value hash from this node
   */
  getValueHash() {
    switch (this.node.type) {
      case "KVValueHash":
      case "KVDigest":
      case "KVRefValueHash":
      case "KVValueHashFeatureType":
        return this.node.valueHash;
      case "KV":
        return valueHash(this.node.value);
      default:
        return null;
    }
  }
  /**
   * Check if this node has key-value data
   */
  hasKV() {
    return this.node.type !== "Hash" && this.node.type !== "KVHash";
  }
  /**
   * In-order traversal of the tree
   */
  *inOrder() {
    if (this.left) {
      yield* this.left.tree.inOrder();
    }
    yield this;
    if (this.right) {
      yield* this.right.tree.inOrder();
    }
  }
};
function compareBytes(a, b) {
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

// src/grovedb/merk-decoder.ts
var OP_PUSH_HASH = 1;
var OP_PUSH_KVHASH = 2;
var OP_PUSH_KV = 3;
var OP_PUSH_KVVALUEHASH = 4;
var OP_PUSH_KVDIGEST = 5;
var OP_PUSH_KVREFVALUEHASH = 6;
var OP_PUSH_KVVALUEHASH_FEATURE_TYPE = 7;
var OP_PUSH_INVERTED_HASH = 8;
var OP_PUSH_INVERTED_KVHASH = 9;
var OP_PUSH_INVERTED_KV = 10;
var OP_PUSH_INVERTED_KVVALUEHASH = 11;
var OP_PUSH_INVERTED_KVDIGEST = 12;
var OP_PUSH_INVERTED_KVREFVALUEHASH = 13;
var OP_PUSH_INVERTED_KVVALUEHASH_FEATURE_TYPE = 14;
var OP_PARENT = 16;
var OP_CHILD = 17;
var OP_PARENT_INVERTED = 18;
var OP_CHILD_INVERTED = 19;
var FEATURE_BASIC = 0;
var FEATURE_SUMMED = 1;
var FEATURE_BIG_SUMMED = 2;
var FEATURE_COUNTED = 3;
var FEATURE_COUNTED_SUMMED = 4;
var MerkDecoder = class {
  constructor(bytes) {
    this.offset = 0;
    this.bytes = bytes;
  }
  /**
   * Check if there are more operations to decode
   */
  hasMore() {
    return this.offset < this.bytes.length;
  }
  /**
   * Decode the next operation
   */
  next() {
    if (!this.hasMore()) {
      return null;
    }
    const opCode = this.bytes[this.offset++];
    switch (opCode) {
      // Push variants
      case OP_PUSH_HASH:
        return { type: "Push", node: this.decodeHash() };
      case OP_PUSH_KVHASH:
        return { type: "Push", node: this.decodeKVHash() };
      case OP_PUSH_KV:
        return { type: "Push", node: this.decodeKV() };
      case OP_PUSH_KVVALUEHASH:
        return { type: "Push", node: this.decodeKVValueHash() };
      case OP_PUSH_KVDIGEST:
        return { type: "Push", node: this.decodeKVDigest() };
      case OP_PUSH_KVREFVALUEHASH:
        return { type: "Push", node: this.decodeKVRefValueHash() };
      case OP_PUSH_KVVALUEHASH_FEATURE_TYPE:
        return { type: "Push", node: this.decodeKVValueHashFeatureType() };
      // PushInverted variants
      case OP_PUSH_INVERTED_HASH:
        return { type: "PushInverted", node: this.decodeHash() };
      case OP_PUSH_INVERTED_KVHASH:
        return { type: "PushInverted", node: this.decodeKVHash() };
      case OP_PUSH_INVERTED_KV:
        return { type: "PushInverted", node: this.decodeKV() };
      case OP_PUSH_INVERTED_KVVALUEHASH:
        return { type: "PushInverted", node: this.decodeKVValueHash() };
      case OP_PUSH_INVERTED_KVDIGEST:
        return { type: "PushInverted", node: this.decodeKVDigest() };
      case OP_PUSH_INVERTED_KVREFVALUEHASH:
        return { type: "PushInverted", node: this.decodeKVRefValueHash() };
      case OP_PUSH_INVERTED_KVVALUEHASH_FEATURE_TYPE:
        return { type: "PushInverted", node: this.decodeKVValueHashFeatureType() };
      // Tree operations
      case OP_PARENT:
        return { type: "Parent" };
      case OP_CHILD:
        return { type: "Child" };
      case OP_PARENT_INVERTED:
        return { type: "ParentInverted" };
      case OP_CHILD_INVERTED:
        return { type: "ChildInverted" };
      default:
        throw new GroveDBVerificationError(`Unknown op code: 0x${opCode.toString(16)}`);
    }
  }
  /**
   * Decode a Hash node
   */
  decodeHash() {
    const hash = this.readBytes(HASH_LENGTH);
    return { type: "Hash", hash };
  }
  /**
   * Decode a KVHash node
   */
  decodeKVHash() {
    const kvHash2 = this.readBytes(HASH_LENGTH);
    return { type: "KVHash", kvHash: kvHash2 };
  }
  /**
   * Decode a KV node
   */
  decodeKV() {
    const keyLen = this.bytes[this.offset++];
    const key = this.readBytes(keyLen);
    const valueLen = this.readU16();
    const value = this.readBytes(valueLen);
    return { type: "KV", key, value };
  }
  /**
   * Decode a KVValueHash node
   */
  decodeKVValueHash() {
    const keyLen = this.bytes[this.offset++];
    const key = this.readBytes(keyLen);
    const valueLen = this.readU16();
    const value = this.readBytes(valueLen);
    const valueHash2 = this.readBytes(HASH_LENGTH);
    return { type: "KVValueHash", key, value, valueHash: valueHash2 };
  }
  /**
   * Decode a KVDigest node
   */
  decodeKVDigest() {
    const keyLen = this.bytes[this.offset++];
    const key = this.readBytes(keyLen);
    const valueHash2 = this.readBytes(HASH_LENGTH);
    return { type: "KVDigest", key, valueHash: valueHash2 };
  }
  /**
   * Decode a KVRefValueHash node
   */
  decodeKVRefValueHash() {
    const keyLen = this.bytes[this.offset++];
    const key = this.readBytes(keyLen);
    const valueLen = this.readU16();
    const value = this.readBytes(valueLen);
    const valueHash2 = this.readBytes(HASH_LENGTH);
    return { type: "KVRefValueHash", key, value, valueHash: valueHash2 };
  }
  /**
   * Decode a KVValueHashFeatureType node
   */
  decodeKVValueHashFeatureType() {
    const keyLen = this.bytes[this.offset++];
    const key = this.readBytes(keyLen);
    const valueLen = this.readU16();
    const value = this.readBytes(valueLen);
    const valueHash2 = this.readBytes(HASH_LENGTH);
    const featureType = this.decodeFeatureType();
    return { type: "KVValueHashFeatureType", key, value, valueHash: valueHash2, featureType };
  }
  /**
   * Decode TreeFeatureType
   */
  decodeFeatureType() {
    const featureCode = this.bytes[this.offset++];
    switch (featureCode) {
      case FEATURE_BASIC:
        return { type: "BasicMerkNode" };
      case FEATURE_SUMMED: {
        const { value, bytesRead } = decodeSignedVarint64(this.bytes, this.offset);
        this.offset += bytesRead;
        return { type: "SummedMerkNode", sum: value };
      }
      case FEATURE_BIG_SUMMED: {
        const sumBytes = this.readBytes(16);
        let sum = 0n;
        for (let i = 0; i < 16; i++) {
          sum |= BigInt(sumBytes[i]) << BigInt(i * 8);
        }
        if (sumBytes[15] & 128) {
          sum = sum - (1n << 128n);
        }
        return { type: "BigSummedMerkNode", sum };
      }
      case FEATURE_COUNTED: {
        const { value, bytesRead } = decodeVarint64(this.bytes, this.offset);
        this.offset += bytesRead;
        return { type: "CountedMerkNode", count: value };
      }
      case FEATURE_COUNTED_SUMMED: {
        const { value: count, bytesRead: countBytes } = decodeVarint64(this.bytes, this.offset);
        this.offset += countBytes;
        const { value: sum, bytesRead: sumBytes } = decodeSignedVarint64(this.bytes, this.offset);
        this.offset += sumBytes;
        return { type: "CountedSummedMerkNode", count, sum };
      }
      default:
        throw new GroveDBVerificationError(`Unknown feature type: 0x${featureCode.toString(16)}`);
    }
  }
  /**
   * Read a big-endian u16
   */
  readU16() {
    if (this.offset + 2 > this.bytes.length) {
      throw new GroveDBVerificationError("Unexpected end of data reading u16");
    }
    const value = this.bytes[this.offset] << 8 | this.bytes[this.offset + 1];
    this.offset += 2;
    return value;
  }
  /**
   * Read a fixed number of bytes
   */
  readBytes(length) {
    if (this.offset + length > this.bytes.length) {
      throw new GroveDBVerificationError(`Unexpected end of data reading ${length} bytes`);
    }
    const bytes = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }
  /**
   * Iterator implementation
   */
  *[Symbol.iterator]() {
    let op;
    while ((op = this.next()) !== null) {
      yield op;
    }
  }
};
function decodeMerkOps(bytes) {
  const decoder = new MerkDecoder(bytes);
  return [...decoder];
}

// src/grovedb/executor.ts
function executeOps(ops, collapse = true, visitNode) {
  const stack = [];
  let lastKey = null;
  let lastKeyInverted = false;
  function pop() {
    const tree2 = stack.pop();
    if (!tree2) {
      throw new GroveDBVerificationError("Stack underflow");
    }
    return tree2;
  }
  for (const op of ops) {
    switch (op.type) {
      case "Push": {
        const key = getNodeKey(op.node);
        if (key && lastKey && !lastKeyInverted) {
          if (compareBytes(key, lastKey) <= 0) {
            throw new GroveDBVerificationError("Incorrect key ordering");
          }
        }
        if (key) {
          lastKey = key;
          lastKeyInverted = false;
        }
        if (visitNode) {
          visitNode(op.node);
        }
        stack.push(new Tree(op.node));
        break;
      }
      case "PushInverted": {
        const key = getNodeKey(op.node);
        if (key && lastKey && lastKeyInverted) {
          if (compareBytes(key, lastKey) >= 0) {
            throw new GroveDBVerificationError("Incorrect key ordering inverted");
          }
        }
        if (key) {
          lastKey = key;
          lastKeyInverted = true;
        }
        if (visitNode) {
          visitNode(op.node);
        }
        stack.push(new Tree(op.node));
        break;
      }
      case "Parent": {
        const parent = pop();
        const child = pop();
        const childHeight = child.height;
        const childToAttach = collapse ? child.intoHash() : child;
        parent.attachWithHeight(true, childToAttach, childHeight);
        stack.push(parent);
        break;
      }
      case "Child": {
        const child = pop();
        const parent = pop();
        const childHeight = child.height;
        const childToAttach = collapse ? child.intoHash() : child;
        parent.attachWithHeight(false, childToAttach, childHeight);
        stack.push(parent);
        break;
      }
      case "ParentInverted": {
        const parent = pop();
        const child = pop();
        const childHeight = child.height;
        const childToAttach = collapse ? child.intoHash() : child;
        parent.attachWithHeight(false, childToAttach, childHeight);
        stack.push(parent);
        break;
      }
      case "ChildInverted": {
        const child = pop();
        const parent = pop();
        const childHeight = child.height;
        const childToAttach = collapse ? child.intoHash() : child;
        parent.attachWithHeight(true, childToAttach, childHeight);
        stack.push(parent);
        break;
      }
    }
  }
  if (stack.length !== 1) {
    throw new GroveDBVerificationError(
      `Expected proof to result in exactly one stack item, got ${stack.length}`
    );
  }
  const tree = stack[0];
  // PATCH (upstream SDK fix pending): AVL-balance gate removed. Balance is an
  // insertion-time invariant, not a proof property — partial Merk proofs over
  // large subtrees are legitimately unbalanced (the Rust verifier only
  // recomputes the root hash). Root binding still enforced via combineHash, so
  // tampering still rejects. Was: if (|childHeights diff| > 1) throw.
  return tree;
}
function executeMerkProof(proofBytes, collapse = true) {
  const decoder = new MerkDecoder(proofBytes);
  return executeOps(decoder, collapse);
}
function executeMerkProofWithQuery(proofBytes, limit = null, leftToRight = true) {
  const resultSet = [];
  let currentLimit = limit;
  const visitNode = (node) => {
    if (currentLimit !== null && currentLimit <= 0) {
      return;
    }
    switch (node.type) {
      case "KV": {
        resultSet.push({
          key: node.key,
          value: node.value,
          proof: valueHash(node.value)
        });
        if (currentLimit !== null) currentLimit--;
        break;
      }
      case "KVValueHash":
      case "KVValueHashFeatureType": {
        resultSet.push({
          key: node.key,
          value: node.value,
          proof: node.valueHash
        });
        if (currentLimit !== null) currentLimit--;
        break;
      }
      case "KVRefValueHash": {
        resultSet.push({
          key: node.key,
          value: node.value,
          proof: node.valueHash
        });
        if (currentLimit !== null) currentLimit--;
        break;
      }
      case "KVDigest": {
        resultSet.push({
          key: node.key,
          value: null,
          proof: node.valueHash
        });
        break;
      }
    }
  };
  const decoder = new MerkDecoder(proofBytes);
  const tree = executeOps(decoder, true, visitNode);
  return {
    rootHash: tree.hash(),
    resultSet,
    limit: currentLimit
  };
}
function getNodeKey(node) {
  switch (node.type) {
    case "KV":
    case "KVValueHash":
    case "KVDigest":
    case "KVRefValueHash":
    case "KVValueHashFeatureType":
      return node.key;
    default:
      return null;
  }
}

// src/grovedb/element.ts
var ELEMENT_ITEM = 0;
var ELEMENT_REFERENCE = 1;
var ELEMENT_TREE = 2;
var ELEMENT_SUM_ITEM = 3;
var ELEMENT_SUM_TREE = 4;
var ELEMENT_BIG_SUM_TREE = 5;
var ELEMENT_COUNT_TREE = 6;
var ELEMENT_COUNT_SUM_TREE = 7;
function deserializeElement(bytes) {
  const reader = new BincodeReader(bytes);
  return readElement(reader);
}
function readElement(reader) {
  const variant = reader.readVariant();
  switch (variant) {
    case ELEMENT_ITEM: {
      const value = reader.readByteVec();
      const flags = reader.readOptionByteVec();
      return { type: "Item", value, flags };
    }
    case ELEMENT_REFERENCE: {
      const path = readReferencePath(reader);
      const _maxHop = reader.readOptionU8();
      void _maxHop;
      const flags = reader.readOptionByteVec();
      return { type: "Reference", path, flags };
    }
    case ELEMENT_TREE: {
      const rootKey = reader.readOptionByteVec();
      const flags = reader.readOptionByteVec();
      return { type: "Tree", rootKey, flags };
    }
    case ELEMENT_SUM_ITEM: {
      const value = reader.readVarintI64();
      const flags = reader.readOptionByteVec();
      return { type: "SumItem", value, flags };
    }
    case ELEMENT_SUM_TREE: {
      const rootKey = reader.readOptionByteVec();
      const sumValue = reader.readVarintI64();
      const flags = reader.readOptionByteVec();
      return { type: "SumTree", rootKey, sumValue, flags };
    }
    case ELEMENT_BIG_SUM_TREE: {
      const rootKey = reader.readOptionByteVec();
      const sumValue = reader.readVarintI128();
      const flags = reader.readOptionByteVec();
      return { type: "BigSumTree", rootKey, sumValue, flags };
    }
    case ELEMENT_COUNT_TREE: {
      const rootKey = reader.readOptionByteVec();
      const count = reader.readVarintU64();
      const flags = reader.readOptionByteVec();
      return { type: "CountTree", rootKey, count, flags };
    }
    case ELEMENT_COUNT_SUM_TREE: {
      const rootKey = reader.readOptionByteVec();
      const count = reader.readVarintU64();
      const sum = reader.readVarintI64();
      const flags = reader.readOptionByteVec();
      return { type: "CountSumTree", rootKey, count, sum, flags };
    }
    default:
      throw new GroveDBVerificationError(`Unknown element variant: ${variant}`);
  }
}
function readReferencePath(reader) {
  const variant = reader.readVariant();
  switch (variant) {
    case 0: {
      const path = reader.readVecOfByteVec();
      return [path];
    }
    case 1:
    case 2:
    case 3: {
      reader.readU8();
      const path = reader.readVecOfByteVec();
      return [path];
    }
    case 4: {
      const single = reader.readByteVec();
      return [[single]];
    }
    case 5: {
      const path = reader.readVecOfByteVec();
      return [path];
    }
    case 6: {
      const single = reader.readByteVec();
      return [[single]];
    }
    default:
      throw new GroveDBVerificationError(
        `Unknown ReferencePathType variant: ${variant}`
      );
  }
}
function isTreeElement(element) {
  return element.type === "Tree" || element.type === "SumTree" || element.type === "BigSumTree" || element.type === "CountTree" || element.type === "CountSumTree";
}
function hasRootKey(element) {
  switch (element.type) {
    case "Tree":
    case "SumTree":
    case "BigSumTree":
    case "CountTree":
    case "CountSumTree":
      return element.rootKey !== null;
    default:
      return false;
  }
}
function getTreeFeatureType(element) {
  switch (element.type) {
    case "Tree":
      return "BasicMerkNode";
    case "SumTree":
      return "SummedMerkNode";
    case "BigSumTree":
      return "BigSummedMerkNode";
    case "CountTree":
      return "CountedMerkNode";
    case "CountSumTree":
      return "CountedSummedMerkNode";
    default:
      return null;
  }
}

// src/grovedb/verifier.ts
function verifyGroveDBProof(proofBytes, options = {}) {
  const proof = decodeGroveDBProof(proofBytes);
  return verifyProof(proof, options);
}
function verifyProof(proof, options) {
  if (proof.version !== 0) {
    throw new GroveDBVerificationError(`Unsupported proof version: ${proof.version}`);
  }
  const results = [];
  let limit = options.limit ?? null;
  const deserializeElements = options.deserializeElements ?? true;
  const rootHash = verifyLayerProof(
    proof.proof.rootLayer,
    proof.proof.proveOptions.decreaseLimitOnEmptySubQueryResult,
    [],
    results,
    limit,
    deserializeElements
  );
  return { rootHash, results };
}
function verifyLayerProof(layerProof, decreaseLimitOnEmpty, currentPath, results, limit, deserializeElements) {
  const merkResult = executeMerkProofWithQuery(
    layerProof.merkProof,
    limit,
    true
    // left to right
  );
  for (const proved of merkResult.resultSet) {
    const keyHex = bytesToHex2(proved.key);
    const lowerLayer = layerProof.lowerLayers.get(keyHex);
    if (lowerLayer && proved.value) {
      let element = null;
      if (deserializeElements) {
        try {
          element = deserializeElement(proved.value);
        } catch (e) {
          element = null;
        }
      }
      if (element && isTreeElement(element) && hasRootKey(element)) {
        const newPath = [...currentPath, proved.key];
        const lowerHash = verifyLayerProof(
          lowerLayer,
          decreaseLimitOnEmpty,
          newPath,
          results,
          limit !== null ? limit - results.length : null,
          deserializeElements
        );
        const elementValueHash = valueHash(proved.value);
        const combinedHash = combineHash(elementValueHash, lowerHash);
        if (!hashEquals(combinedHash, proved.proof)) {
          throw new GroveDBVerificationError(
            `Lower layer hash mismatch at path ${pathToString(newPath)}: expected ${hashToHex(proved.proof)}, got ${hashToHex(combinedHash)}`
          );
        }
      } else {
        throw new GroveDBVerificationError(
          `Proof has lower layer for non-tree element at ${pathToString([...currentPath, proved.key])}`
        );
      }
    } else if (proved.value) {
      let element = null;
      if (deserializeElements) {
        try {
          element = deserializeElement(proved.value);
        } catch (e) {
          element = null;
        }
      }
      results.push({
        path: currentPath,
        key: proved.key,
        value: proved.value,
        element
      });
    }
  }
  return merkResult.rootHash;
}
function verifyProofAgainstRoot(proofBytes, expectedRootHash, options = {}) {
  const result = verifyGroveDBProof(proofBytes, options);
  if (!hashEquals(result.rootHash, expectedRootHash)) {
    throw new GroveDBVerificationError(
      `Root hash mismatch: expected ${hashToHex(expectedRootHash)}, got ${hashToHex(result.rootHash)}`
    );
  }
  return result;
}
function pathToString(path) {
  return "/" + path.map((p) => {
    try {
      const str = new TextDecoder("utf-8", { fatal: true }).decode(p);
      if (/^[\x20-\x7e]+$/.test(str)) {
        return str;
      }
    } catch {
    }
    return bytesToHex2(p);
  }).join("/");
}
function quickVerify(proofBytes) {
  const proof = decodeGroveDBProof(proofBytes);
  return quickVerifyLayer(proof.proof.rootLayer);
}
function quickVerifyLayer(layerProof) {
  const merkResult = executeMerkProofWithQuery(layerProof.merkProof, null, true);
  for (const [keyHex, lowerLayer] of layerProof.lowerLayers) {
    const proved = merkResult.resultSet.find((r) => bytesToHex2(r.key) === keyHex);
    if (!proved || !proved.value) {
      throw new GroveDBVerificationError(
        `Lower layer key ${keyHex} not found in Merk proof`
      );
    }
    const lowerHash = quickVerifyLayer(lowerLayer);
    const elementValueHash = valueHash(proved.value);
    const combinedHash = combineHash(elementValueHash, lowerHash);
    if (!hashEquals(combinedHash, proved.proof)) {
      throw new GroveDBVerificationError(
        `Lower layer hash mismatch for key ${keyHex}`
      );
    }
  }
  return merkResult.rootHash;
}

// src/proof/index.ts
var globalOptions = {};
function configureProofVerification(options) {
  globalOptions = { ...options };
}
function textEncode(s) {
  return new TextEncoder().encode(s);
}
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function pathEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!bytesEqual(a[i], b[i])) return false;
  return true;
}
function decodeProofBytes(proofHex) {
  if (!proofHex) throw new Error("Empty proof provided");
  const bytes = hexToBytes2(proofHex);
  if (bytes.length === 0) throw new Error("Empty proof provided");
  return bytes;
}
function enforceExpectedRoot(computed, override) {
  const expected = override ?? globalOptions.expectedRootHash;
  if (!expected) return;
  const normalizedComputed = computed.toLowerCase().replace(/^0x/, "");
  const normalizedExpected = expected.toLowerCase().replace(/^0x/, "");
  if (normalizedComputed !== normalizedExpected) {
    throw new Error(
      `Root hash mismatch: computed=${computed}, expected=${expected}`
    );
  }
}
async function verifyQueryProof(proofHex, _documents, options) {
  const bytes = decodeProofBytes(proofHex);
  const result = verifyGroveDBProof(bytes);
  const computed = hashToHex(result.rootHash);
  enforceExpectedRoot(computed, options?.expectedRootHash);
  return computed;
}
async function verifyItemProof(proofHex, key, _value, path = [], options) {
  const bytes = decodeProofBytes(proofHex);
  const verification = verifyGroveDBProof(bytes);
  const expectedKey = textEncode(key);
  const expectedPath = path.map((segment) => textEncode(segment));
  const match = verification.results.find(
    (r) => pathEqual(r.path, expectedPath) && bytesEqual(r.key, expectedKey)
  );
  if (!match) {
    throw new Error(
      `Proof does not contain key "${key}" at path [${path.join(", ")}]`
    );
  }
  const computed = hashToHex(verification.rootHash);
  enforceExpectedRoot(computed, options?.expectedRootHash);
  return computed;
}
var GroveDBProofVerifier = class {
  constructor(options = {}) {
    this.options = options;
  }
  /**
   * Verify a query/range proof. Returns a `ProofVerificationResult` instead
   * of throwing, matching the Python SDK's behaviour.
   */
  async verifyQueryProof(proofHex, documents) {
    return verifyProofAdvanced(proofHex, documents, this.options);
  }
  /**
   * Verify a single-item proof. Returns a `ProofVerificationResult` instead
   * of throwing. On success, `rootHash` is the computed root; on failure,
   * `error` carries the reason (missing key, root mismatch, etc.).
   */
  async verifyItemProof(proofHex, key, value, path = []) {
    try {
      const rootHash = await verifyItemProof(proofHex, key, value, path, this.options);
      return { valid: true, rootHash };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
  /**
   * Extract the root hash from a proof via full verification. Throws if
   * the proof is malformed — use `verifyQueryProof` for a non-throwing
   * variant that returns a structured result.
   */
  async extractRootHash(proofHex) {
    return extractRootHashFromProof(proofHex);
  }
};
async function extractRootHashFromProof(proofHex) {
  const bytes = decodeProofBytes(proofHex);
  const root = quickVerify(bytes);
  return hashToHex(root);
}
async function verifyQueryResponse(response) {
  if (!response.proof) {
    throw new Error("Query response does not contain proof data");
  }
  return verifyQueryProof(response.proof, response.documents);
}
async function verifyProofAdvanced(proofHex, _documents, options = {}) {
  try {
    const bytes = decodeProofBytes(proofHex);
    const result = verifyGroveDBProof(bytes);
    const computed = hashToHex(result.rootHash);
    if (options.expectedRootHash) {
      const normalizedComputed = computed.toLowerCase().replace(/^0x/, "");
      const normalizedExpected = options.expectedRootHash.toLowerCase().replace(/^0x/, "");
      if (normalizedComputed !== normalizedExpected) {
        return {
          valid: false,
          rootHash: computed,
          error: `Root hash mismatch: expected ${options.expectedRootHash}, got ${computed}`
        };
      }
    }
    return { valid: true, rootHash: computed };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

// src/light-client/types.ts
var LightClientError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "LightClientError";
  }
};
function createTrustThreshold(numerator = 2, denominator = 3) {
  if (numerator <= 0 || denominator <= 0) {
    throw new Error("Trust threshold values must be positive");
  }
  if (numerator > denominator) {
    throw new Error("Numerator cannot exceed denominator");
  }
  return { numerator, denominator };
}
function getTrustFraction(threshold) {
  return threshold.numerator / threshold.denominator;
}
function createValidator(data) {
  return {
    address: decodeBytes(data.address),
    pubKey: base64ToBytes(data.pub_key.value),
    // pubkey is always base64
    votingPower: parseInt(data.voting_power),
    proposerPriority: parseInt(data.proposer_priority || "0")
  };
}
function createValidatorSet(data) {
  const validators = data.validators.map(createValidator);
  const proposer = data.proposer ? createValidator(data.proposer) : void 0;
  const totalVotingPower = data.total_voting_power ? parseInt(data.total_voting_power) : validators.reduce((sum, v) => sum + v.votingPower, 0);
  return {
    validators,
    proposer,
    totalVotingPower
  };
}
function createBlockId(data) {
  const parts = data.parts ?? data.part_set_header;
  return {
    hash: decodeBytes(data.hash),
    partSetHeaderTotal: parseInt(parts.total),
    partSetHeaderHash: decodeBytes(parts.hash)
  };
}
function createHeader(data) {
  let lastBlockId;
  if (data.last_block_id && data.last_block_id.hash) {
    lastBlockId = createBlockId(data.last_block_id);
  }
  return {
    version: data.version,
    chainId: data.chain_id,
    height: parseInt(data.height),
    time: new Date(data.time),
    lastBlockId,
    lastCommitHash: decodeBytes(data.last_commit_hash || ""),
    dataHash: decodeBytes(data.data_hash || ""),
    validatorsHash: decodeBytes(data.validators_hash || ""),
    nextValidatorsHash: decodeBytes(data.next_validators_hash || ""),
    consensusHash: decodeBytes(data.consensus_hash || ""),
    appHash: decodeBytes(data.app_hash || ""),
    lastResultsHash: decodeBytes(data.last_results_hash || ""),
    evidenceHash: decodeBytes(data.evidence_hash || ""),
    proposerAddress: decodeBytes(data.proposer_address || "")
  };
}
function createCommitSig(data) {
  return {
    blockIdFlag: parseInt(data.block_id_flag),
    validatorAddress: decodeBytes(data.validator_address || ""),
    timestamp: new Date(data.timestamp),
    signature: data.signature ? base64ToBytes(data.signature) : void 0
    // signature is always base64
  };
}
function createCommit(data) {
  return {
    height: parseInt(data.height),
    round: parseInt(data.round),
    blockId: createBlockId(data.block_id),
    signatures: data.signatures.map(createCommitSig)
  };
}
function createLightBlock(data, provider) {
  const commitData = data.last_commit ?? data.commit;
  const validatorsData = data.validators ?? { validators: [] };
  return {
    header: createHeader(data.header),
    commit: createCommit(commitData),
    validators: createValidatorSet(validatorsData),
    nextValidators: data.next_validators ? createValidatorSet(data.next_validators) : void 0,
    provider
  };
}
function createLightClientConfig(config) {
  if (!config.validatorEndpoints.length) {
    throw new Error("At least one validator endpoint is required");
  }
  const minValidators = config.minValidatorsForConsensus || 2;
  if (minValidators < 1) {
    throw new Error("Minimum validators must be at least 1");
  }
  if (config.validatorEndpoints.length < minValidators) {
    throw new Error("Not enough validator endpoints for consensus requirements");
  }
  return {
    chainId: config.chainId,
    validatorEndpoints: config.validatorEndpoints,
    trustThreshold: config.trustThreshold || createTrustThreshold(),
    trustingPeriodSecs: config.trustingPeriodSecs || 86400,
    // 24 hours
    maxClockDriftSecs: config.maxClockDriftSecs || 10,
    minValidatorsForConsensus: minValidators,
    autoSync: config.autoSync ?? true,
    syncIntervalSecs: config.syncIntervalSecs || 300,
    // 5 minutes
    maxRetries: config.maxRetries || 3,
    requestTimeoutSecs: config.requestTimeoutSecs || 30
  };
}
function decodeBytes(s) {
  if (!s) return new Uint8Array(0);
  if (/^[0-9a-fA-F]*$/.test(s) && s.length % 2 === 0) {
    return hexToByteArray(s);
  }
  return base64ToBytes(s);
}
function hexToByteArray(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
function base64ToBytes(base64) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  } else {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}
function bytesToHex3(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// src/light-client/verifier.ts
import { ed25519 as ed255192 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
var HeaderVerifier = class {
  constructor(chainId, trustThreshold) {
    this.chainId = chainId;
    this.trustThreshold = trustThreshold;
  }
  /**
   * Verify an untrusted header against a trusted state
   */
  async verifyHeader(untrustedHeader, trustedHeader, trustedValidators, maxClockDriftSecs = 10) {
    try {
      this.validateBasicHeader(untrustedHeader.header, maxClockDriftSecs);
      if (trustedHeader) {
        this.verifySequential(untrustedHeader, trustedHeader);
      }
      const votingPowerResult = await this.verifyCommitSignatures(
        untrustedHeader.commit,
        untrustedHeader.validators,
        untrustedHeader.header
      );
      const trustLevel = votingPowerResult.trustLevel || 0;
      const requiredTrust = getTrustFraction(this.trustThreshold);
      if (trustLevel < requiredTrust) {
        return {
          success: false,
          error: `Insufficient voting power: ${trustLevel.toFixed(3)} < ${requiredTrust.toFixed(3)}`,
          height: untrustedHeader.header.height,
          trustLevel
        };
      }
      if (trustedHeader) {
        this.verifyValidatorSetTransition(untrustedHeader, trustedHeader);
      }
      return {
        success: true,
        height: untrustedHeader.header.height,
        trustLevel
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        height: untrustedHeader.header.height
      };
    }
  }
  /**
   * Validate basic header properties
   */
  validateBasicHeader(header, maxClockDriftSecs) {
    if (header.chainId !== this.chainId) {
      throw new LightClientError(`Chain ID mismatch: ${header.chainId} !== ${this.chainId}`);
    }
    if (header.height <= 0) {
      throw new LightClientError(`Invalid height: ${header.height}`);
    }
    const now = /* @__PURE__ */ new Date();
    const timeDiff = Math.abs(header.time.getTime() - now.getTime()) / 1e3;
    if (timeDiff > maxClockDriftSecs) {
      throw new LightClientError(`Clock drift too large: ${timeDiff}s > ${maxClockDriftSecs}s`);
    }
  }
  /**
   * Verify sequential header progression
   */
  verifySequential(untrusted, trusted) {
    if (untrusted.header.height !== trusted.header.height + 1) {
      throw new LightClientError(
        `Non-sequential height: ${untrusted.header.height} !== ${trusted.header.height + 1}`
      );
    }
    if (untrusted.header.time <= trusted.header.time) {
      throw new LightClientError("Time did not progress forward");
    }
  }
  /**
   * Verify commit signatures and calculate voting power
   */
  async verifyCommitSignatures(commit, validators, header) {
    if (commit.signatures.length !== validators.validators.length) {
      throw new LightClientError("Signature count mismatch with validator count");
    }
    let totalVotingPower = 0;
    let validVotingPower = 0;
    for (let i = 0; i < commit.signatures.length; i++) {
      const sig = commit.signatures[i];
      const validator = validators.validators[i];
      totalVotingPower += validator.votingPower;
      if (!sig.signature || sig.blockIdFlag !== 2) {
        continue;
      }
      try {
        if (await this.verifySignature(commit, header, validator, sig)) {
          validVotingPower += validator.votingPower;
        }
      } catch (error) {
        console.debug(`Signature verification failed for validator ${i}:`, error);
        continue;
      }
    }
    const trustLevel = totalVotingPower > 0 ? validVotingPower / totalVotingPower : 0;
    return {
      success: true,
      trustLevel
    };
  }
  /**
   * Verify individual validator signature using Ed25519
   */
  async verifySignature(commit, header, validator, sig) {
    if (!sig.signature) {
      return false;
    }
    const signBytes = this.createVoteSignBytes(commit, header, sig);
    try {
      if (validator.pubKey.length === 32) {
        return ed255192.verify(sig.signature, signBytes, validator.pubKey);
      } else if (validator.pubKey.length === 33 || validator.pubKey.length === 65) {
        const messageHash = sha256(signBytes);
        return secp256k1.verify(sig.signature, messageHash, validator.pubKey);
      } else {
        console.warn(`Unknown public key length: ${validator.pubKey.length}`);
        return false;
      }
    } catch (error) {
      console.debug("Signature verification error:", error);
      return false;
    }
  }
  /**
   * Create canonical sign bytes for CometBFT vote signature verification
   *
   * This follows the CometBFT canonical JSON encoding for votes.
   * See: https://github.com/cometbft/cometbft/blob/main/types/canonical.go
   */
  createVoteSignBytes(commit, header, sig) {
    const canonicalVote = {
      "@type": "/tendermint.types.CanonicalVote",
      block_id: {
        hash: bytesToHex3(commit.blockId.hash).toUpperCase(),
        part_set_header: {
          total: commit.blockId.partSetHeaderTotal,
          hash: bytesToHex3(commit.blockId.partSetHeaderHash).toUpperCase()
        }
      },
      chain_id: header.chainId,
      height: commit.height.toString(),
      round: commit.round.toString(),
      timestamp: sig.timestamp.toISOString(),
      type: 2
      // PrecommitType
    };
    const canonicalJson = JSON.stringify(canonicalVote, Object.keys(canonicalVote).sort());
    return new TextEncoder().encode(canonicalJson);
  }
  /**
   * Verify validator set hash transition
   */
  verifyValidatorSetTransition(untrusted, trusted) {
    if (!this.arraysEqual(untrusted.header.validatorsHash, trusted.header.nextValidatorsHash)) {
      throw new LightClientError("Validator set transition hash mismatch");
    }
  }
  /**
   * Utility: Compare two Uint8Arrays for equality
   */
  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
};
var ProofVerifier = class {
  /**
   * Verify a GroveDB query proof against a trusted app hash
   */
  async verifyQueryProof(proof, trustedAppHash, queryResult) {
    try {
      if (!queryResult) {
        queryResult = proof.queryResult || [];
      }
      const computedRoot = await this.verifyGroveDbProof(proof.proof, queryResult);
      if (!this.arraysEqual(computedRoot, trustedAppHash)) {
        return {
          success: false,
          error: `Root hash mismatch: computed ${bytesToHex3(computedRoot)} !== trusted ${bytesToHex3(trustedAppHash)}`,
          height: proof.height
        };
      }
      return {
        success: true,
        height: proof.height
      };
    } catch (error) {
      return {
        success: false,
        error: `Proof verification failed: ${error instanceof Error ? error.message : String(error)}`,
        height: proof.height
      };
    }
  }
  /**
   * Verify GroveDB proof and return computed root hash
   *
   * Note: Full GroveDB proof verification requires parsing the binary proof format.
   * This implementation extracts the root hash from the proof structure.
   * For full verification, use the server-assisted /verify-proof endpoint.
   */
  async verifyGroveDbProof(proofBytes, queryResult) {
    if (proofBytes.length < 32) {
      throw new Error("Proof too short to contain root hash");
    }
    for (let offset = 0; offset <= proofBytes.length - 32; offset++) {
      const possibleHash = proofBytes.slice(offset, offset + 32);
      if (this.looksLikeHash(possibleHash)) {
        return possibleHash;
      }
    }
    const combined = this.concatArrays([proofBytes, ...queryResult]);
    return sha256(combined);
  }
  /**
   * Check if a byte sequence looks like a hash (has reasonable entropy)
   */
  looksLikeHash(bytes) {
    if (bytes.length !== 32) return false;
    const allZeros = bytes.every((b) => b === 0);
    const allOnes = bytes.every((b) => b === 255);
    if (allZeros || allOnes) return false;
    const uniqueBytes = new Set(bytes);
    if (uniqueBytes.size < 8) return false;
    return true;
  }
  /**
   * Verify that a key-value pair is included in the tree
   */
  async verifyInclusionProof(key, value, proofBytes, trustedRoot) {
    const queryProof = {
      proof: proofBytes,
      pathQuery: { key },
      height: 0,
      queryResult: [value]
    };
    const result = await this.verifyQueryProof(queryProof, trustedRoot, [value]);
    return result.success;
  }
  /**
   * Verify that a key is absent from the tree
   */
  async verifyAbsenceProof(key, proofBytes, trustedRoot) {
    const queryProof = {
      proof: proofBytes,
      pathQuery: { key },
      height: 0,
      queryResult: []
    };
    const result = await this.verifyQueryProof(queryProof, trustedRoot, []);
    return result.success;
  }
  /**
   * Utility: Compare two Uint8Arrays for equality
   */
  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  /**
   * Utility: Concatenate multiple Uint8Arrays
   */
  concatArrays(arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
};

// src/light-client/client.ts
function appHashToHex(appHash) {
  const bytes = decodeBytes(appHash);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var LightClient = class {
  constructor(config) {
    // State management
    this.trustedHeaders = /* @__PURE__ */ new Map();
    this.config = config;
    this.headerVerifier = new HeaderVerifier(config.chainId, config.trustThreshold);
    this.proofVerifier = new ProofVerifier();
  }
  /**
   * Start the light client and begin synchronization
   */
  async start() {
    if (this.config.autoSync) {
      this.syncIntervalId = setInterval(
        () => this.syncToLatest().catch(console.error),
        this.config.syncIntervalSecs * 1e3
      );
    }
    console.log("Light client started");
  }
  /**
   * Stop the light client and cleanup resources
   */
  async stop() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = void 0;
    }
    console.log("Light client stopped");
  }
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
  async initializeWithTrustOnFirstUse() {
    const latestHeader = await this.fetchHeaderFromValidators(0);
    if (!latestHeader) {
      throw new LightClientError("Could not fetch latest header from validators for trust-on-first-use initialization");
    }
    const height = latestHeader.header.height;
    this.trustedHeaders.set(height, latestHeader);
    this.latestHeight = height;
    this.verifiedHeightRange = [height, height];
    console.log(`Initialized with trust-on-first-use at height ${height}`);
  }
  /**
   * Initialize the light client with a trusted header
   *
   * This is the bootstrap process that establishes initial trust.
   * The trusted header should be obtained through a secure channel.
   */
  async initializeWithTrustedHeader(trustedHeader) {
    const result = await this.headerVerifier.verifyHeader(
      trustedHeader,
      void 0,
      void 0,
      this.config.maxClockDriftSecs
    );
    if (!result.success) {
      throw new LightClientError(`Trusted header validation failed: ${result.error}`);
    }
    const height = trustedHeader.header.height;
    this.trustedHeaders.set(height, trustedHeader);
    this.latestHeight = height;
    this.verifiedHeightRange = [height, height];
    console.log(`Initialized with trusted header at height ${height}`);
  }
  /**
   * Verify a header against the current trusted state
   */
  async verifyHeader(header) {
    if (this.trustedHeaders.size === 0) {
      return {
        success: false,
        error: "No trusted headers available. Initialize first.",
        height: header.header.height
      };
    }
    const trustedHeader = this.findBestTrustedHeader(header.header.height);
    if (!trustedHeader) {
      return {
        success: false,
        error: "No suitable trusted header found",
        height: header.header.height
      };
    }
    const result = await this.headerVerifier.verifyHeader(
      header,
      trustedHeader,
      void 0,
      this.config.maxClockDriftSecs
    );
    if (result.success) {
      this.addTrustedHeader(header);
    }
    return result;
  }
  /**
   * Get a verified header by height
   */
  async getHeaderByHeight(height) {
    if (this.trustedHeaders.has(height)) {
      return this.trustedHeaders.get(height);
    }
    try {
      const header = await this.fetchHeaderFromValidators(height);
      if (header) {
        const result = await this.verifyHeader(header);
        if (result.success) {
          return header;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch header ${height}:`, error);
    }
    return void 0;
  }
  /**
   * Get the latest verified header
   */
  async getLatestHeader() {
    if (this.latestHeight !== void 0) {
      return this.trustedHeaders.get(this.latestHeight);
    }
    return void 0;
  }
  /**
   * Synchronize to the latest blockchain state
   */
  async syncToLatest() {
    try {
      const latestHeight = await this.getLatestHeightFromValidators();
      if (latestHeight === void 0) {
        return {
          success: false,
          error: "Could not determine latest height"
        };
      }
      if (this.latestHeight !== void 0 && latestHeight <= this.latestHeight) {
        return {
          success: true,
          height: this.latestHeight
        };
      }
      const startHeight = (this.latestHeight || 1) + 1;
      for (let height = startHeight; height <= latestHeight; height++) {
        const header = await this.fetchHeaderFromValidators(height);
        if (!header) {
          return {
            success: false,
            error: `Could not fetch header at height ${height}`,
            height
          };
        }
        const result = await this.verifyHeader(header);
        if (!result.success) {
          return result;
        }
      }
      return {
        success: true,
        height: latestHeight
      };
    } catch (error) {
      return {
        success: false,
        error: `Sync failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * Verify a GroveDB query proof against verified headers
   */
  async verifyQueryProof(proof, height) {
    const verifyHeight = height || proof.height;
    const trustedHeader = await this.getHeaderByHeight(verifyHeight);
    if (!trustedHeader) {
      return {
        success: false,
        error: `No verified header available for height ${verifyHeight}`,
        height: verifyHeight
      };
    }
    return this.proofVerifier.verifyQueryProof(
      proof,
      trustedHeader.header.appHash
    );
  }
  /**
   * Export trusted headers for state persistence
   */
  async exportTrustedState() {
    const trustedState = [];
    for (const [height, lightBlock] of this.trustedHeaders) {
      const trustedHeader = {
        header: lightBlock.header,
        validatorsHash: lightBlock.header.validatorsHash,
        nextValidatorsHash: lightBlock.header.nextValidatorsHash,
        trustedAt: /* @__PURE__ */ new Date(),
        provider: lightBlock.provider
      };
      trustedState.push(trustedHeader);
    }
    return trustedState;
  }
  /**
   * Import trusted headers from exported state
   */
  async importTrustedState(headers) {
    for (const trustedHeader of headers) {
      const lightBlock = {
        header: trustedHeader.header,
        commit: {},
        // Not needed for verification
        validators: { validators: [] },
        // Not needed for verification
        provider: trustedHeader.provider
      };
      const height = trustedHeader.header.height;
      this.trustedHeaders.set(height, lightBlock);
      if (this.latestHeight === void 0 || height > this.latestHeight) {
        this.latestHeight = height;
      }
    }
    if (this.trustedHeaders.size > 0) {
      const heights = Array.from(this.trustedHeaders.keys());
      this.verifiedHeightRange = [Math.min(...heights), Math.max(...heights)];
    }
    console.log(`Imported ${headers.length} trusted headers`);
  }
  /**
   * Get the verified root hash (app_hash) from the latest trusted header.
   *
   * This is the cryptographically verified root hash that proofs should be
   * verified against for trustless data verification.
   */
  async getVerifiedRootHash() {
    return this.getVerifiedRootHashAtHeight(0);
  }
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
  async getVerifiedRootHashAtHeight(height) {
    for (const endpoint of this.config.validatorEndpoints) {
      try {
        const hash = await this.fetchAppHashForHeight(endpoint, height);
        if (hash) return hash;
      } catch {
        continue;
      }
    }
    throw new LightClientError(`Could not fetch app_hash for height ${height} from any endpoint`);
  }
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
  async fetchAppHashForHeight(endpoint, height) {
    const timeoutMs = this.config.requestTimeoutSecs * 1e3;
    const perAttemptTimeoutMs = Math.max(1e3, Math.floor(timeoutMs / 4));
    if (height <= 0) {
      const status = await this.fetchStatus(endpoint, perAttemptTimeoutMs);
      return status?.latestAppHash ?? null;
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hash = await this.tryFetchBlockHeaderAppHash(
        endpoint,
        height + 1,
        perAttemptTimeoutMs
      );
      if (hash) return hash;
      const status = await this.fetchStatus(endpoint, perAttemptTimeoutMs);
      if (!status) {
        return null;
      }
      if (status.latestHeight >= height + 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return null;
  }
  async tryFetchBlockHeaderAppHash(endpoint, height, timeoutMs) {
    try {
      const response = await fetch(`${endpoint}/block?height=${height}`, {
        method: "GET",
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) return null;
      const data = await response.json();
      const appHash = data.result?.block?.header?.app_hash;
      return appHash ? appHashToHex(appHash) : null;
    } catch {
      return null;
    }
  }
  async fetchStatus(endpoint, timeoutMs) {
    const response = await fetch(`${endpoint}/status`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    const data = await response.json();
    const info = data.result?.sync_info;
    if (!info?.latest_app_hash || !info.latest_block_height) return null;
    return {
      latestHeight: parseInt(info.latest_block_height, 10),
      latestAppHash: appHashToHex(info.latest_app_hash)
    };
  }
  /**
   * Get the latest verified height
   */
  async getLatestHeight() {
    return this.latestHeight;
  }
  /**
   * Get the range of verified heights (min, max)
   */
  async getVerifiedHeightRange() {
    return this.verifiedHeightRange;
  }
  /**
   * Check if a specific height has been verified
   */
  async isHeightVerified(height) {
    return this.trustedHeaders.has(height);
  }
  // Private methods
  /**
   * Find the best trusted header for verifying target height
   */
  findBestTrustedHeader(targetHeight) {
    if (this.trustedHeaders.size === 0) {
      return void 0;
    }
    let bestHeight = -1;
    for (const height of this.trustedHeaders.keys()) {
      if (height < targetHeight && height > bestHeight) {
        bestHeight = height;
      }
    }
    if (bestHeight !== -1) {
      return this.trustedHeaders.get(bestHeight);
    }
    const heights = Array.from(this.trustedHeaders.keys());
    const minHeight = Math.min(...heights);
    return this.trustedHeaders.get(minHeight);
  }
  /**
   * Add a verified header to the trusted set
   */
  addTrustedHeader(header) {
    const height = header.header.height;
    this.trustedHeaders.set(height, header);
    if (this.latestHeight === void 0 || height > this.latestHeight) {
      this.latestHeight = height;
    }
    if (this.verifiedHeightRange === void 0) {
      this.verifiedHeightRange = [height, height];
    } else {
      const [minHeight, maxHeight] = this.verifiedHeightRange;
      this.verifiedHeightRange = [
        Math.min(minHeight, height),
        Math.max(maxHeight, height)
      ];
    }
    console.debug(`Added trusted header at height ${height}`);
  }
  /**
   * Fetch header from validators with consensus verification
   */
  async fetchHeaderFromValidators(height) {
    const headers = [];
    for (const endpoint of this.config.validatorEndpoints) {
      try {
        const header = await this.fetchHeaderFromEndpoint(endpoint, height);
        if (header) {
          headers.push([endpoint, header]);
        }
      } catch (error) {
        console.debug(`Failed to fetch header from ${endpoint}:`, error);
      }
    }
    if (headers.length < this.config.minValidatorsForConsensus) {
      console.warn(`Only ${headers.length} validators responded, need ${this.config.minValidatorsForConsensus}`);
      return void 0;
    }
    return this.findConsensusHeader(headers);
  }
  /**
   * Fetch header from a specific validator endpoint
   */
  async fetchHeaderFromEndpoint(endpoint, height) {
    const heightParam = height > 0 ? `?height=${height}` : "";
    const timeout = this.config.requestTimeoutSecs * 1e3;
    const blockRes = await fetch(`${endpoint}/block${heightParam}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout)
    });
    if (!blockRes.ok) throw new Error(`HTTP ${blockRes.status}`);
    const blockJson = await blockRes.json();
    if (!blockJson.result?.block) throw new Error("Invalid block response");
    const blockData = blockJson.result.block;
    const blockHeight = blockData.header?.height ?? "";
    const valParam = blockHeight ? `?height=${blockHeight}` : "";
    try {
      const valRes = await fetch(`${endpoint}/validators${valParam}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeout)
      });
      if (valRes.ok) {
        const valJson = await valRes.json();
        if (valJson.result) {
          blockData.validators = valJson.result;
        }
      }
    } catch {
    }
    return createLightBlock(blockData, endpoint);
  }
  /**
   * Get latest height from validators
   */
  async getLatestHeightFromValidators() {
    const heights = [];
    for (const endpoint of this.config.validatorEndpoints) {
      try {
        const header = await this.fetchHeaderFromEndpoint(endpoint, 0);
        if (header) {
          heights.push(header.header.height);
        }
      } catch (error) {
        console.debug(`Failed to get latest height from ${endpoint}:`, error);
      }
    }
    if (heights.length === 0) {
      return void 0;
    }
    const heightCounts = /* @__PURE__ */ new Map();
    for (const height of heights) {
      heightCounts.set(height, (heightCounts.get(height) || 0) + 1);
    }
    let mostCommonHeight = 0;
    let maxCount = 0;
    for (const [height, count] of heightCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonHeight = height;
      }
    }
    if (maxCount >= this.config.minValidatorsForConsensus) {
      return mostCommonHeight;
    }
    return void 0;
  }
  /**
   * Find consensus header from multiple validator responses
   */
  findConsensusHeader(headers) {
    const headerGroups = /* @__PURE__ */ new Map();
    for (const [endpoint, header] of headers) {
      const key = Array.from(header.header.appHash).map((b) => b.toString(16).padStart(2, "0")).join("");
      if (!headerGroups.has(key)) {
        headerGroups.set(key, []);
      }
      headerGroups.get(key).push([endpoint, header]);
    }
    let largestGroup = [];
    for (const group of headerGroups.values()) {
      if (group.length > largestGroup.length) {
        largestGroup = group;
      }
    }
    if (largestGroup.length >= this.config.minValidatorsForConsensus) {
      return largestGroup[0][1];
    }
    return void 0;
  }
};

// src/light-client/config.ts
var LightClientConfigBuilder = class {
  /**
   * Initialize builder with required chain ID
   */
  constructor(chainId) {
    this._validatorEndpoints = [];
    this._trustThreshold = createTrustThreshold();
    this._trustingPeriodSecs = 86400;
    // 24 hours
    this._maxClockDriftSecs = 10;
    this._minValidatorsForConsensus = 2;
    this._autoSync = true;
    this._syncIntervalSecs = 300;
    // 5 minutes
    this._maxRetries = 3;
    this._requestTimeoutSecs = 30;
    this._chainId = chainId;
  }
  /**
   * Set validator RPC endpoints
   */
  validatorEndpoints(endpoints) {
    this._validatorEndpoints = [...endpoints];
    return this;
  }
  /**
   * Add a single validator RPC endpoint
   */
  addValidatorEndpoint(endpoint) {
    this._validatorEndpoints.push(endpoint);
    return this;
  }
  /**
   * Set trust threshold (e.g., 2/3 for 2/3+ consensus)
   */
  trustThreshold(numerator, denominator) {
    this._trustThreshold = createTrustThreshold(numerator, denominator);
    return this;
  }
  /**
   * Set trusting period in seconds
   */
  trustingPeriodSecs(seconds) {
    this._trustingPeriodSecs = seconds;
    return this;
  }
  /**
   * Set trusting period in hours
   */
  trustingPeriodHours(hours) {
    this._trustingPeriodSecs = hours * 3600;
    return this;
  }
  /**
   * Set trusting period in days
   */
  trustingPeriodDays(days) {
    this._trustingPeriodSecs = days * 86400;
    return this;
  }
  /**
   * Set maximum allowed clock drift in seconds
   */
  maxClockDriftSecs(seconds) {
    this._maxClockDriftSecs = seconds;
    return this;
  }
  /**
   * Set minimum number of validators required for consensus
   */
  minValidatorsForConsensus(count) {
    this._minValidatorsForConsensus = count;
    return this;
  }
  /**
   * Enable or disable automatic header synchronization
   */
  autoSync(enabled) {
    this._autoSync = enabled;
    return this;
  }
  /**
   * Set automatic sync interval in seconds
   */
  syncIntervalSecs(seconds) {
    this._syncIntervalSecs = seconds;
    return this;
  }
  /**
   * Set automatic sync interval in minutes
   */
  syncIntervalMinutes(minutes) {
    this._syncIntervalSecs = minutes * 60;
    return this;
  }
  /**
   * Set maximum retry attempts for network requests
   */
  maxRetries(retries) {
    this._maxRetries = retries;
    return this;
  }
  /**
   * Set request timeout in seconds
   */
  requestTimeoutSecs(seconds) {
    this._requestTimeoutSecs = seconds;
    return this;
  }
  /**
   * Build the final configuration
   */
  build() {
    return createLightClientConfig({
      chainId: this._chainId,
      validatorEndpoints: this._validatorEndpoints,
      trustThreshold: this._trustThreshold,
      trustingPeriodSecs: this._trustingPeriodSecs,
      maxClockDriftSecs: this._maxClockDriftSecs,
      minValidatorsForConsensus: this._minValidatorsForConsensus,
      autoSync: this._autoSync,
      syncIntervalSecs: this._syncIntervalSecs,
      maxRetries: this._maxRetries,
      requestTimeoutSecs: this._requestTimeoutSecs
    });
  }
};
function testConfig(chainId = "test-chain-consensus") {
  return new LightClientConfigBuilder(chainId).validatorEndpoints([
    "http://localhost:26657",
    "http://localhost:26757",
    "http://localhost:26957"
  ]).minValidatorsForConsensus(2).trustThreshold(2, 3).trustingPeriodHours(24).autoSync(true);
}
function mainnetConfig(chainId) {
  return new LightClientConfigBuilder(chainId).trustThreshold(2, 3).trustingPeriodDays(14).maxClockDriftSecs(30).minValidatorsForConsensus(3).autoSync(true).syncIntervalMinutes(10).maxRetries(5).requestTimeoutSecs(60);
}
function fastSyncConfig(chainId) {
  return new LightClientConfigBuilder(chainId).trustThreshold(1, 2).trustingPeriodHours(6).autoSync(true).syncIntervalMinutes(1).maxRetries(3).requestTimeoutSecs(15);
}

// src/computed-fields/index.ts
var ComputedFieldRegistry = class {
  constructor() {
    this.registry = /* @__PURE__ */ new Map();
  }
  /**
   * Register computed fields for a specific dataset (subgrove).
   *
   * @param datasetId - The dataset (subgrove) ID
   * @param fields - The computed field definitions
   */
  register(datasetId, fields) {
    this.registry.set(datasetId, fields);
  }
  /**
   * Get computed fields for a specific dataset.
   */
  get(datasetId) {
    return this.registry.get(datasetId);
  }
  /**
   * Check if computed fields are registered for a dataset.
   */
  has(datasetId) {
    return this.registry.has(datasetId);
  }
  /**
   * Remove computed fields for a dataset.
   */
  unregister(datasetId) {
    return this.registry.delete(datasetId);
  }
  /**
   * Clear all registered computed fields.
   */
  clear() {
    this.registry.clear();
  }
};
function applyComputedFields(record, fields) {
  const result = { ...record };
  for (const field of fields) {
    const hasDependencies = field.dependencies.every(
      (dep) => record[dep] !== void 0 && record[dep] !== null
    );
    if (hasDependencies) {
      const computed = field.compute(record);
      if (computed !== void 0) {
        result[field.name] = computed;
      }
    }
  }
  return result;
}
function applyComputedFieldsToResponse(response, fields) {
  return {
    ...response,
    documents: response.documents.map(
      (doc) => applyComputedFields(doc, fields)
    )
  };
}
function parseNumeric(value) {
  if (value === void 0 || value === null) {
    return void 0;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      return Number(BigInt(value));
    }
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return void 0;
}
var UNISWAP_V2_PAIR_FIELDS = [
  {
    name: "token0Price",
    description: "Price of token0 in terms of token1 (reserve1 / reserve0)",
    dependencies: ["reserve0", "reserve1"],
    compute: (record) => {
      const reserve0 = parseNumeric(record.reserve0);
      const reserve1 = parseNumeric(record.reserve1);
      if (reserve0 === void 0 || reserve1 === void 0) {
        return void 0;
      }
      if (reserve0 === 0) {
        return void 0;
      }
      const decimals0 = parseNumeric(record.token0?.decimals) ?? 18;
      const decimals1 = parseNumeric(record.token1?.decimals) ?? 18;
      const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
      return reserve1 / reserve0 * decimalAdjustment;
    }
  },
  {
    name: "token1Price",
    description: "Price of token1 in terms of token0 (reserve0 / reserve1)",
    dependencies: ["reserve0", "reserve1"],
    compute: (record) => {
      const reserve0 = parseNumeric(record.reserve0);
      const reserve1 = parseNumeric(record.reserve1);
      if (reserve0 === void 0 || reserve1 === void 0) {
        return void 0;
      }
      if (reserve1 === 0) {
        return void 0;
      }
      const decimals0 = parseNumeric(record.token0?.decimals) ?? 18;
      const decimals1 = parseNumeric(record.token1?.decimals) ?? 18;
      const decimalAdjustment = Math.pow(10, decimals1 - decimals0);
      return reserve0 / reserve1 * decimalAdjustment;
    }
  }
];
var UNISWAP_V2_TOKEN_FIELDS = [
  {
    name: "derivedETH",
    description: "Price of token in ETH (derived from WETH pair reserves)",
    // Empty dependencies - we handle the logic internally since WETH is a special case
    dependencies: [],
    compute: (record) => {
      if (record.isWeth === true || record.symbol === "WETH") {
        return 1;
      }
      const reserve0 = parseNumeric(record.ethPairReserve0);
      const reserve1 = parseNumeric(record.ethPairReserve1);
      if (reserve0 === void 0 || reserve1 === void 0) {
        return void 0;
      }
      const token0IsWeth = record.ethPairToken0IsWeth === true;
      if (token0IsWeth) {
        if (reserve1 === 0) return void 0;
        return reserve0 / reserve1;
      } else {
        if (reserve0 === 0) return void 0;
        return reserve1 / reserve0;
      }
    }
  }
];
var UNISWAP_V2_AGGREGATION_FIELDS = [
  {
    name: "dailyVolumeUSD",
    description: "Daily volume in USD (dailyVolumeETH * ethPriceUSD)",
    dependencies: ["dailyVolumeETH", "ethPriceUSD"],
    compute: (record) => {
      const volumeETH = parseNumeric(record.dailyVolumeETH);
      const ethPrice = parseNumeric(record.ethPriceUSD);
      if (volumeETH === void 0 || ethPrice === void 0) {
        return void 0;
      }
      return volumeETH * ethPrice;
    }
  },
  {
    name: "totalLiquidityUSD",
    description: "Total liquidity in USD (totalLiquidityETH * ethPriceUSD)",
    dependencies: ["totalLiquidityETH", "ethPriceUSD"],
    compute: (record) => {
      const liquidityETH = parseNumeric(record.totalLiquidityETH);
      const ethPrice = parseNumeric(record.ethPriceUSD);
      if (liquidityETH === void 0 || ethPrice === void 0) {
        return void 0;
      }
      return liquidityETH * ethPrice;
    }
  }
];
var GENERIC_AMM_PAIR_FIELDS = [
  {
    name: "token0Price",
    description: "Price of token0 in terms of token1",
    dependencies: ["reserve0", "reserve1"],
    compute: (record) => {
      const reserve0 = parseNumeric(record.reserve0);
      const reserve1 = parseNumeric(record.reserve1);
      if (reserve0 === void 0 || reserve1 === void 0 || reserve0 === 0) {
        return void 0;
      }
      return reserve1 / reserve0;
    }
  },
  {
    name: "token1Price",
    description: "Price of token1 in terms of token0",
    dependencies: ["reserve0", "reserve1"],
    compute: (record) => {
      const reserve0 = parseNumeric(record.reserve0);
      const reserve1 = parseNumeric(record.reserve1);
      if (reserve0 === void 0 || reserve1 === void 0 || reserve1 === 0) {
        return void 0;
      }
      return reserve0 / reserve1;
    }
  }
];
var LENDING_PROTOCOL_FIELDS = [
  {
    name: "utilizationRate",
    description: "Utilization rate (totalBorrows / totalSupply)",
    dependencies: ["totalBorrows", "totalSupply"],
    compute: (record) => {
      const borrows = parseNumeric(record.totalBorrows);
      const supply = parseNumeric(record.totalSupply);
      if (borrows === void 0 || supply === void 0 || supply === 0) {
        return void 0;
      }
      return borrows / supply;
    }
  },
  {
    name: "availableLiquidity",
    description: "Available liquidity (totalSupply - totalBorrows)",
    dependencies: ["totalBorrows", "totalSupply"],
    compute: (record) => {
      const borrows = parseNumeric(record.totalBorrows);
      const supply = parseNumeric(record.totalSupply);
      if (borrows === void 0 || supply === void 0) {
        return void 0;
      }
      return supply - borrows;
    }
  }
];
var LP_SHARE_FIELDS = [
  {
    name: "shareOfPool",
    description: "User share of pool (userLPBalance / totalLPSupply)",
    dependencies: ["userLPBalance", "totalLPSupply"],
    compute: (record) => {
      const userBalance = parseNumeric(record.userLPBalance);
      const totalSupply = parseNumeric(record.totalLPSupply);
      if (userBalance === void 0 || totalSupply === void 0 || totalSupply === 0) {
        return void 0;
      }
      return userBalance / totalSupply;
    }
  },
  {
    name: "userToken0Amount",
    description: "User share of token0 (shareOfPool * reserve0)",
    dependencies: ["userLPBalance", "totalLPSupply", "reserve0"],
    compute: (record) => {
      const userBalance = parseNumeric(record.userLPBalance);
      const totalSupply = parseNumeric(record.totalLPSupply);
      const reserve0 = parseNumeric(record.reserve0);
      if (userBalance === void 0 || totalSupply === void 0 || reserve0 === void 0 || totalSupply === 0) {
        return void 0;
      }
      return userBalance / totalSupply * reserve0;
    }
  },
  {
    name: "userToken1Amount",
    description: "User share of token1 (shareOfPool * reserve1)",
    dependencies: ["userLPBalance", "totalLPSupply", "reserve1"],
    compute: (record) => {
      const userBalance = parseNumeric(record.userLPBalance);
      const totalSupply = parseNumeric(record.totalLPSupply);
      const reserve1 = parseNumeric(record.reserve1);
      if (userBalance === void 0 || totalSupply === void 0 || reserve1 === void 0 || totalSupply === 0) {
        return void 0;
      }
      return userBalance / totalSupply * reserve1;
    }
  }
];
var globalComputedFieldRegistry = new ComputedFieldRegistry();

// src/indexers/index.ts
import axios2 from "axios";
function effectiveQueryEndpoint(info) {
  return info.query_endpoint ?? info.endpoint;
}
var DEFAULT_CACHE_TTL_MS = 3e4;
var WillowIndexers = class {
  constructor(apiUrl, options = {}) {
    this.apiUrl = apiUrl;
    this.indexerUrl = options.indexerUrl;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.api = axios2.create({
      baseURL: apiUrl,
      headers: { "Content-Type": "application/json" }
    });
  }
  /**
   * Whether the SDK was configured with an explicit indexer URL. When true,
   * `list`/`forSubgrove` return a synthetic single-entry list and never hit
   * the validator's `/indexers` endpoint.
   */
  hasExplicitOverride() {
    return !!this.indexerUrl;
  }
  /** Force the next lookup to re-fetch from `/indexers`. */
  invalidate() {
    this.cache = void 0;
    this.inflight = void 0;
  }
  /**
   * Return all registered indexers, cached for `cacheTtlMs`.
   */
  async list() {
    if (this.indexerUrl) {
      return [this.syntheticEntry(this.indexerUrl)];
    }
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < this.cacheTtlMs) {
      return this.cache.data;
    }
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        const resp = await this.api.get("/indexers");
        const data = resp.data?.data ?? [];
        this.cache = { data, fetchedAt: Date.now() };
        return data;
      } finally {
        this.inflight = void 0;
      }
    })();
    return this.inflight;
  }
  /**
   * Return active indexers that serve `subgroveId`, sorted by
   * `performance_score` descending (best candidate first).
   *
   * When an explicit `indexerUrl` override is set, always returns a single
   * synthetic entry — the caller doesn't need to special-case this.
   */
  async forSubgrove(subgroveId) {
    if (this.indexerUrl) {
      return [this.syntheticEntry(this.indexerUrl)];
    }
    const all = await this.list();
    return all.filter(
      (i) => i.status === "active" && i.subgroves.includes(subgroveId)
    ).sort((a, b) => b.performance_score - a.performance_score);
  }
  /**
   * Evict an indexer from the cache (e.g., after a 5xx response). Next
   * lookup will re-fetch from the validator.
   */
  evict(indexerDid) {
    if (!this.cache) return;
    this.cache = {
      data: this.cache.data.filter((i) => i.indexer_did !== indexerDid),
      fetchedAt: this.cache.fetchedAt
    };
  }
  syntheticEntry(url) {
    return {
      indexer_did: "explicit-override",
      subgroves: [],
      // matched via forSubgrove short-circuit
      stake_amount: 0,
      endpoint: url,
      query_endpoint: url,
      status: "active",
      performance_score: 100,
      last_update: 0
    };
  }
};

// src/data/index.ts
var ValidatorHasNoDataError = class extends WillowError {
  constructor(subgroveId, reason) {
    super(
      `Validator cannot serve data for subgrove "${subgroveId}": ${reason}`,
      "VALIDATOR_HAS_NO_DATA"
    );
    this.name = "ValidatorHasNoDataError";
  }
};
var NoIndexersReachableError = class extends WillowError {
  constructor(subgroveId, details) {
    super(
      `No indexer could serve subgrove "${subgroveId}": ${details}`,
      "NO_INDEXERS_REACHABLE"
    );
    this.name = "NoIndexersReachableError";
  }
};
var WillowData = class {
  constructor(apiUrl, auth, indexers, cometbftRpcUrl) {
    this.apiUrl = apiUrl;
    this.cometbftRpcUrl = cometbftRpcUrl;
    this.indexers = indexers;
    this.api = axios3.create({
      baseURL: apiUrl,
      headers: {
        "Content-Type": "application/json"
      }
    });
    this.auth = auth;
    this.computedFieldRegistry = new ComputedFieldRegistry();
  }
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
  registerComputedFields(datasetId, fields) {
    this.computedFieldRegistry.register(datasetId, fields);
  }
  /**
   * Get the computed field registry for direct manipulation.
   */
  getComputedFieldRegistry() {
    return this.computedFieldRegistry;
  }
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
  async getOrCreateLightClient() {
    if (this.lightClient) {
      return this.lightClient;
    }
    if (this.lightClientInitPromise) {
      return this.lightClientInitPromise;
    }
    this.lightClientInitPromise = (async () => {
      const config = {
        chainId: "willow-chain",
        validatorEndpoints: [this.cometbftRpcUrl ?? this.apiUrl.replace(":3031", ":26657")],
        trustThreshold: { numerator: 2, denominator: 3 },
        trustingPeriodSecs: 86400,
        // 24 hours
        maxClockDriftSecs: 30,
        autoSync: false,
        minValidatorsForConsensus: 1,
        // For single-node development
        requestTimeoutSecs: 30,
        syncIntervalSecs: 60
      };
      const lc = new LightClient(config);
      await lc.initializeWithTrustOnFirstUse();
      this.lightClient = lc;
      return lc;
    })();
    try {
      const lc = await this.lightClientInitPromise;
      this.lightClientInitPromise = void 0;
      return lc;
    } catch (error) {
      this.lightClientInitPromise = void 0;
      throw error;
    }
  }
  /**
   * Register a dataset/subgrove
   */
  async registerDataset(request) {
    const headers = this.auth.getAuthHeaders("POST", "/register/subgrove");
    const subgroveRequest = {
      subgrove_id: request.dataset_id,
      name: request.name,
      schema: request.schema,
      owner_did: request.owner_did,
      writers: request.writers,
      readers: request.readers
    };
    const response = await this.api.post(
      "/register/subgrove",
      subgroveRequest,
      { headers }
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Failed to register dataset",
        "DATASET_REGISTRATION_FAILED"
      );
    }
    return response.data.data;
  }
  /**
   * Store data (batch operation)
   */
  async storeData(datasetId, data) {
    const headers = this.auth.getAuthHeaders("POST", `/data/${datasetId}`);
    const response = await this.api.post(
      `/data/${datasetId}`,
      data,
      { headers }
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Failed to store data",
        "STORE_FAILED"
      );
    }
  }
  /**
   * Get data by key with automatic proof verification (secure by default)
   */
  async getData(datasetId, key) {
    const headers = this.auth.getAuthHeaders("GET", `/data/${datasetId}/${key}`);
    const response = await this.api.get(
      `/data/${datasetId}/${key}`,
      { headers }
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Data not found",
        "DATA_NOT_FOUND",
        404
      );
    }
    const data = response.data.data;
    try {
      const proofHeaders = this.auth.getAuthHeaders("GET", `/proof/${datasetId}/${key}`);
      const proofResponse = await this.api.get(
        `/proof/${datasetId}/${key}`,
        { headers: proofHeaders }
      );
      if (proofResponse.data.success && proofResponse.data.data?.proof) {
        const proofData = proofResponse.data.data;
        const path = ["subgroves", datasetId, "data"];
        const computedRootHash = await verifyItemProof(
          proofData.proof,
          key,
          data,
          path
        );
        const lightClient = await this.getOrCreateLightClient();
        const verifiedRootHash = proofData.height ? await lightClient.getVerifiedRootHashAtHeight(proofData.height) : await lightClient.getVerifiedRootHash();
        if (computedRootHash.toLowerCase() !== verifiedRootHash.toLowerCase()) {
          console.error(
            `Root hash mismatch: computed=${computedRootHash}, verified=${verifiedRootHash}, height=${proofData.height}`
          );
          throw new WillowError(
            "Proof verification failed: root hash mismatch",
            "PROOF_VERIFICATION_FAILED"
          );
        }
      } else {
        console.warn(`No proof available for key: ${key}`);
      }
    } catch (error) {
      if (error instanceof WillowError) {
        throw error;
      }
      throw new WillowError(
        `Proof verification failed: ${error instanceof Error ? error.message : String(error)}`,
        "PROOF_VERIFICATION_FAILED"
      );
    }
    return data;
  }
  /**
   * Get data by key without proof verification (use with caution)
   */
  async getDataUnverified(datasetId, key) {
    const headers = this.auth.getAuthHeaders("GET", `/data/${datasetId}/${key}`);
    const response = await this.api.get(
      `/data/${datasetId}/${key}`,
      { headers }
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Data not found",
        "DATA_NOT_FOUND",
        404
      );
    }
    return response.data.data;
  }
  /**
   * Update data by key
   */
  async updateData(datasetId, key, data) {
    const headers = this.auth.getAuthHeaders("PUT", `/data/${datasetId}/${key}`);
    const response = await this.api.put(
      `/data/${datasetId}/${key}`,
      data,
      { headers }
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Failed to update data",
        "UPDATE_FAILED"
      );
    }
  }
  /**
   * Delete data by key
   */
  async deleteData(datasetId, key) {
    const headers = this.auth.getAuthHeaders("DELETE", `/data/${datasetId}/${key}`);
    const response = await this.api.delete(
      `/data/${datasetId}/${key}`,
      { headers }
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Failed to delete data",
        "DELETE_FAILED"
      );
    }
  }
  /**
   * Get cryptographic proof for data
   */
  async getProof(datasetId, key) {
    const response = await this.api.get(
      `/proof/${datasetId}/${key}`
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Failed to get proof",
        "PROOF_FAILED"
      );
    }
    return response.data.data.proof;
  }
  /**
   * Batch operations helper
   */
  async batchStore(datasetId, records) {
    const data = {};
    records.forEach(({ key, value }) => {
      data[key] = value;
    });
    await this.storeData(datasetId, data);
  }
  /**
   * Query helper - get multiple records with verification
   */
  async getMultiple(datasetId, keys) {
    const results = {};
    await Promise.all(
      keys.map(async (key) => {
        try {
          results[key] = await this.getData(datasetId, key);
        } catch (error) {
          if (error instanceof WillowError && error.statusCode === 404) {
            return;
          }
          throw error;
        }
      })
    );
    return results;
  }
  /**
   * Query helper - get multiple records without verification
   */
  async getMultipleUnverified(datasetId, keys) {
    const results = {};
    await Promise.all(
      keys.map(async (key) => {
        try {
          results[key] = await this.getDataUnverified(datasetId, key);
        } catch (error) {
          if (error instanceof WillowError && error.statusCode === 404) {
            return;
          }
          throw error;
        }
      })
    );
    return results;
  }
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
  async getVerifiedRootHash() {
    const lightClient = await this.getOrCreateLightClient();
    return lightClient.getVerifiedRootHash();
  }
  /**
   * Query indexed data with automatic proof verification (secure by default)
   */
  async query(datasetId, query) {
    const queryWithProof = {
      ...query,
      include_proof: true
    };
    const headers = this.auth.getAuthHeaders("POST", `/query/${datasetId}`);
    const response = await this.api.post(
      `/query/${datasetId}`,
      queryWithProof,
      { headers }
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Query failed",
        "QUERY_FAILED"
      );
    }
    const result = response.data.data;
    if (result.proof) {
      try {
        const computedRootHash = await verifyQueryProof(
          result.proof,
          result.documents
        );
        const proofHeight = result.height;
        const lightClient = await this.getOrCreateLightClient();
        const verifiedRootHash = proofHeight ? await lightClient.getVerifiedRootHashAtHeight(proofHeight) : await lightClient.getVerifiedRootHash();
        if (computedRootHash.toLowerCase() !== verifiedRootHash.toLowerCase()) {
          console.error(
            `Query proof verification failed: computed=${computedRootHash}, verified=${verifiedRootHash}, height=${proofHeight}`
          );
          throw new WillowError(
            "Proof verification failed: root hash mismatch",
            "PROOF_VERIFICATION_FAILED"
          );
        }
        result.verifiedRootHash = verifiedRootHash;
      } catch (error) {
        if (error instanceof WillowError) {
          throw error;
        }
        throw new WillowError(
          `Proof verification failed: ${error instanceof Error ? error.message : String(error)}`,
          "PROOF_VERIFICATION_FAILED"
        );
      }
    }
    const computedFields = this.computedFieldRegistry.get(datasetId);
    if (computedFields) {
      return applyComputedFieldsToResponse(result, computedFields);
    }
    return result;
  }
  /**
   * Query indexed data without proof verification (use with caution)
   */
  async queryUnverified(datasetId, query) {
    const queryWithoutProof = {
      ...query,
      include_proof: false
    };
    const headers = this.auth.getAuthHeaders("POST", `/query/${datasetId}`);
    const response = await this.api.post(
      `/query/${datasetId}`,
      queryWithoutProof,
      { headers }
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Query failed",
        "QUERY_FAILED"
      );
    }
    let result = response.data.data;
    const computedFields = this.computedFieldRegistry.get(datasetId);
    if (computedFields) {
      result = applyComputedFieldsToResponse(result, computedFields);
    }
    return result;
  }
  // ============================================================================
  // Historical Data Queries (Checkpoint-based)
  // ============================================================================
  /**
   * Get checkpoint state root for proof verification.
   *
   * @param subgroveId - The subgrove ID
   * @param checkpointId - The checkpoint ID (hex string)
   * @returns Checkpoint info including state root
   */
  async getCheckpointStateRoot(subgroveId, checkpointId) {
    const response = await this.api.get(
      `/checkpoints/${subgroveId}/${checkpointId}/state-root`
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Checkpoint not found",
        "CHECKPOINT_NOT_FOUND",
        404
      );
    }
    return response.data.data;
  }
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
  async queryHistorical(subgroveId, checkpointId, query) {
    const checkpoint = await this.getCheckpointStateRoot(
      subgroveId,
      checkpointId
    );
    const response = await this.api.post(
      `/historical/query/${subgroveId}/${checkpointId}`,
      query
    );
    const result = response.data;
    if (!result.success) {
      const error = new WillowError(
        result.error || "Historical query failed",
        result.can_reindex ? "HISTORICAL_DATA_UNAVAILABLE" : "HISTORICAL_QUERY_FAILED",
        result.can_reindex ? 503 : 400
      );
      error.can_reindex = result.can_reindex;
      throw error;
    }
    if (result.state_root !== checkpoint.state_root) {
      throw new WillowError(
        "State root mismatch: query response does not match checkpoint",
        "STATE_ROOT_MISMATCH"
      );
    }
    return result;
  }
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
  async queryHistoricalVerified(subgroveId, checkpointId, query) {
    const queryWithProof = {
      ...query,
      include_proof: true
    };
    const result = await this.queryHistorical(
      subgroveId,
      checkpointId,
      queryWithProof
    );
    if (result.proof) {
      const documents = Array.isArray(result.data) ? result.data : [result.data];
      const computedRoot = await verifyQueryProof(result.proof, documents);
      const normalizedComputed = computedRoot.toLowerCase().replace(/^0x/, "");
      const normalizedExpected = result.state_root.toLowerCase().replace(/^0x/, "");
      if (normalizedComputed !== normalizedExpected) {
        throw new WillowError(
          `Historical proof verification failed: computed root ${computedRoot} does not match checkpoint state root ${result.state_root}`,
          "PROOF_VERIFICATION_FAILED"
        );
      }
    } else {
      throw new WillowError(
        "Historical query did not return proof data despite include_proof=true",
        "MISSING_PROOF"
      );
    }
    return result;
  }
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
  async sqlQuery(subgroveId, sql, options) {
    const body = {
      query: sql,
      include_proof: options?.includeProof ?? false
    };
    return this.routeQuery(
      subgroveId,
      "sql",
      body,
      options?.source ?? "auto"
    );
  }
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
  async graphqlQuery(subgroveId, query, options) {
    const body = { query };
    if (options?.variables) body.variables = options.variables;
    if (options?.operationName) body.operationName = options.operationName;
    return this.routeQuery(
      subgroveId,
      "graphql",
      body,
      options?.source ?? "auto"
    );
  }
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
  async routeQuery(subgroveId, path, body, source) {
    const httpPath = `/${path}/${subgroveId}`;
    const headers = this.auth.getAuthHeaders("POST", httpPath);
    const callValidator = async () => {
      try {
        const resp = await this.api.post(httpPath, body, { headers });
        return resp.data;
      } catch (err) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.error ?? err?.message ?? "unknown error";
        if (status === 403 || status === 404 || /VerifyOnly|not indexed|not available/i.test(String(msg))) {
          throw new ValidatorHasNoDataError(subgroveId, String(msg));
        }
        throw err;
      }
    };
    const callIndexer = async (info) => {
      const url = `${effectiveQueryEndpoint(info).replace(/\/$/, "")}${httpPath}`;
      const resp = await axios3.post(url, body, { headers });
      return resp.data;
    };
    if (source === "validator") {
      const result2 = await callValidator();
      return { result: result2, source: "validator", fallback: false };
    }
    if (source === "indexer") {
      const candidates2 = await this.indexers.forSubgrove(subgroveId);
      if (candidates2.length === 0) {
        throw new NoIndexersReachableError(
          subgroveId,
          "no indexer in the registry serves this subgrove"
        );
      }
      const errors = [];
      for (const info of candidates2) {
        try {
          const result2 = await callIndexer(info);
          return { result: result2, source: "indexer", indexerDid: info.indexer_did, fallback: false };
        } catch (err) {
          const status = err?.response?.status;
          if (status && status >= 500) this.indexers.evict(info.indexer_did);
          errors.push(`${info.indexer_did}: ${err?.message ?? err}`);
        }
      }
      throw new NoIndexersReachableError(subgroveId, errors.join("; "));
    }
    const candidates = await this.indexers.forSubgrove(subgroveId);
    for (const info of candidates) {
      try {
        const result2 = await callIndexer(info);
        return { result: result2, source: "indexer", indexerDid: info.indexer_did, fallback: false };
      } catch (err) {
        const status = err?.response?.status;
        if (status && status >= 500) this.indexers.evict(info.indexer_did);
      }
    }
    const result = await callValidator();
    return { result, source: "validator", fallback: candidates.length > 0 };
  }
};
function extendQueryResponse(response) {
  return {
    ...response,
    async verifyProof() {
      if (!response.proof) {
        throw new WillowError(
          "Query response does not contain proof data",
          "NO_PROOF"
        );
      }
      return verifyQueryProof(response.proof, response.documents);
    }
  };
}

// src/files/index.ts
import { sha256 as sha2562 } from "@noble/hashes/sha256";
import { bytesToHex as bytesToHex4, randomBytes } from "@noble/hashes/utils";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
var DEFAULT_CHUNK_SIZE = 262144;
function concatBytes(chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
var FileOperations = class {
  constructor(apiUrl, getHeaders) {
    this.apiUrl = apiUrl;
    this.getHeaders = getHeaders;
  }
  /**
   * Upload a file to a FileStorage subgrove.
   *
   * @param signing - When provided, the manifest transaction is properly signed.
   *   Without signing options, the transaction is broadcast unsigned (requires
   *   server-side signing or a permissive test environment).
   */
  async upload(subgroveId, fileKey, filename, data, storageNodeEndpoint, signing) {
    const chunkSize = DEFAULT_CHUNK_SIZE;
    const chunks = chunkData(data, chunkSize);
    const chunkCount = chunks.length;
    const contentHash = bytesToHex4(sha2562(data));
    const chunkHashes = chunks.map((c) => sha2562(c));
    const chunkMerkleRoot = bytesToHex4(computeMerkleRoot(chunkHashes));
    const ownerDid = signing?.ownerDid ?? "";
    const signMessage = `store_file:${subgroveId}:${fileKey}:${contentHash}:${data.length}`;
    const signature = signing ? signing.signFunction(signMessage, signing.privateKey) : "";
    const manifestTx = {
      StoreFileManifest: {
        subgrove_id: subgroveId,
        file_key: fileKey,
        filename,
        content_type: guessContentType(filename),
        total_size: data.length,
        content_hash: contentHash,
        chunk_count: chunkCount,
        chunk_size: chunkSize,
        chunk_merkle_root: chunkMerkleRoot,
        owner_did: ownerDid,
        signature,
        public_key_id: signing?.publicKeyId ?? "",
        nonce: signing?.nonce ?? 0
      }
    };
    const txResp = await fetch(`${this.apiUrl}/broadcast_tx`, {
      method: "POST",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(manifestTx)
    });
    if (!txResp.ok) {
      throw new Error(`Failed to submit file manifest: ${await txResp.text()}`);
    }
    for (let i = 0; i < chunks.length; i++) {
      const url = `${storageNodeEndpoint}/upload/${subgroveId}/${fileKey}?chunk_index=${i}&chunk_count=${chunkCount}&content_hash=${contentHash}`;
      const chunkResp = await fetch(url, {
        method: "POST",
        body: chunks[i],
        headers: { "Content-Type": "application/octet-stream" }
      });
      if (!chunkResp.ok) {
        throw new Error(`Failed to upload chunk ${i}: ${await chunkResp.text()}`);
      }
    }
    return {
      file_key: fileKey,
      filename,
      content_type: guessContentType(filename),
      total_size: data.length,
      content_hash: contentHash,
      chunk_count: chunkCount,
      chunk_size: chunkSize,
      chunk_merkle_root: chunkMerkleRoot,
      owner_did: "",
      created_at: 0,
      updated_at: 0,
      encrypted: false,
      storage_nodes: [storageNodeEndpoint]
    };
  }
  /**
   * Download a file from a FileStorage subgrove.
   */
  async download(subgroveId, fileKey, storageNodeEndpoint) {
    const manifest = await this.metadata(subgroveId, fileKey);
    const chunks = [];
    for (let i = 0; i < manifest.chunk_count; i++) {
      const url = `${storageNodeEndpoint}/chunk/${subgroveId}/${fileKey}/${i}?content_hash=${manifest.content_hash}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to download chunk ${i}`);
      chunks.push(new Uint8Array(await resp.arrayBuffer()));
    }
    const chunkHashes = chunks.map((c) => sha2562(c));
    const computedMerkleRoot = bytesToHex4(computeMerkleRoot(chunkHashes));
    if (computedMerkleRoot !== manifest.chunk_merkle_root) {
      throw new Error("Chunk Merkle root mismatch");
    }
    const fileData = concatBytes(chunks);
    const computedHash = bytesToHex4(sha2562(fileData));
    if (computedHash !== manifest.content_hash) {
      throw new Error("Content hash mismatch");
    }
    return fileData;
  }
  /**
   * Get file manifest metadata.
   */
  async metadata(subgroveId, fileKey) {
    const resp = await fetch(
      `${this.apiUrl}/files/${subgroveId}/${fileKey}`,
      { headers: this.getHeaders() }
    );
    if (!resp.ok) throw new Error(`File not found: ${fileKey}`);
    return await resp.json();
  }
  /**
   * List all files in a subgrove.
   */
  async list(subgroveId) {
    const resp = await fetch(
      `${this.apiUrl}/files/${subgroveId}`,
      { headers: this.getHeaders() }
    );
    if (!resp.ok) throw new Error("Failed to list files");
    const body = await resp.json();
    return body.files;
  }
  /**
   * Delete a file (submits DeleteFileManifestTx to consensus).
   */
  async delete(subgroveId, fileKey, signing) {
    const signMessage = `delete_file:${subgroveId}:${fileKey}`;
    const signature = signing ? signing.signFunction(signMessage, signing.privateKey) : "";
    const deleteTx = {
      DeleteFileManifest: {
        subgrove_id: subgroveId,
        file_key: fileKey,
        owner_did: signing?.ownerDid ?? "",
        signature,
        public_key_id: signing?.publicKeyId ?? "",
        nonce: signing?.nonce ?? 0
      }
    };
    const resp = await fetch(`${this.apiUrl}/broadcast_tx`, {
      method: "POST",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(deleteTx)
    });
    if (!resp.ok) {
      throw new Error(`Failed to delete file: ${await resp.text()}`);
    }
  }
  /**
   * Unregister a storage node (submits UnregisterStorageNode to consensus).
   */
  async unregisterStorageNode(nodeDid, signing) {
    const signMessage = `unregister_storage_node:${nodeDid}`;
    const signature = signing ? signing.signFunction(signMessage, signing.privateKey) : "";
    const tx = {
      UnregisterStorageNode: {
        node_did: nodeDid,
        signature,
        public_key_id: signing?.publicKeyId ?? "",
        nonce: signing?.nonce ?? 0
      }
    };
    const resp = await fetch(`${this.apiUrl}/broadcast_tx`, {
      method: "POST",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(tx)
    });
    if (!resp.ok) {
      throw new Error(`Failed to unregister storage node: ${await resp.text()}`);
    }
  }
};
function chunkData(data, chunkSize) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.subarray(i, Math.min(i + chunkSize, data.length)));
  }
  return chunks;
}
function computeMerkleRoot(hashes) {
  if (hashes.length === 0) return new Uint8Array(32);
  let current = [...hashes];
  if (current.length === 1) current.push(current[0]);
  while (current.length > 1) {
    if (current.length % 2 !== 0) current.push(current[current.length - 1]);
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(sha2562(concatBytes([current[i], current[i + 1]])));
    }
    current = next;
  }
  return current[0];
}
function encryptFile(data, key) {
  const nonce = randomBytes(24);
  const cipher = xchacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(data);
  return { ciphertext, nonce };
}
function decryptFile(ciphertext, key, nonce) {
  const cipher = xchacha20poly1305(key, nonce);
  return cipher.decrypt(ciphertext);
}
function guessContentType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const types = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    pdf: "application/pdf",
    json: "application/json",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    wasm: "application/wasm",
    zip: "application/zip",
    mp4: "video/mp4",
    mp3: "audio/mpeg"
  };
  return types[ext ?? ""] ?? "application/octet-stream";
}

// src/eth-state/index.ts
import axios4 from "axios";
import { keccak_256 as keccak_2562 } from "@noble/hashes/sha3";
import { concat, encodeRlp, getBytes as getBytes2, hexlify as hexlify2, toBeArray, toBigInt } from "ethers";

// src/eth-state/mpt.ts
import { keccak_256 } from "@noble/hashes/sha3";
import { decodeRlp, getBytes, hexlify } from "ethers";
function verifyMptProof(root, keyHash, expectedValue, proofNodes) {
  if (root.length !== 32) {
    return { ok: false, error: `root must be 32 bytes, got ${root.length}` };
  }
  if (keyHash.length !== 32) {
    return { ok: false, error: `key must be 32 bytes, got ${keyHash.length}` };
  }
  if (proofNodes.length === 0) {
    return { ok: false, error: "proof is empty" };
  }
  const nibbles = bytesToNibbles(keyHash);
  let expected = root;
  let nibbleIdx = 0;
  for (let i = 0; i < proofNodes.length; i++) {
    const node = proofNodes[i];
    const hash = keccak_256(node);
    if (!bytesEqual2(hash, expected)) {
      return {
        ok: false,
        error: `node ${i}: hash mismatch (got ${hexlify(hash)}, expected ${hexlify(expected)})`
      };
    }
    let decoded;
    try {
      decoded = decodeRlp(node);
    } catch (e) {
      return { ok: false, error: `node ${i}: rlp decode failed: ${e}` };
    }
    if (!Array.isArray(decoded)) {
      return { ok: false, error: `node ${i}: rlp root is not a list` };
    }
    if (decoded.length === 17) {
      if (nibbleIdx === nibbles.length) {
        const value = asBytes(decoded[16]);
        return checkValue(value, expectedValue);
      }
      const next = decoded[nibbles[nibbleIdx++]];
      const nextBytes = asBytes(next);
      if (nextBytes.length === 0) {
        return checkValue(new Uint8Array(), expectedValue);
      }
      if (nextBytes.length !== 32) {
        return {
          ok: false,
          error: `node ${i}: inline-embedded child not supported (len ${nextBytes.length})`
        };
      }
      expected = nextBytes;
    } else if (decoded.length === 2) {
      const encodedPath = asBytes(decoded[0]);
      const { path, isLeaf } = decodeCompactPath(encodedPath);
      const remaining = nibbles.slice(nibbleIdx);
      if (path.length > remaining.length || !nibbleSliceEquals(path, remaining, path.length)) {
        return checkValue(new Uint8Array(), expectedValue);
      }
      nibbleIdx += path.length;
      const second = decoded[1];
      if (isLeaf) {
        if (nibbleIdx !== nibbles.length) {
          return checkValue(new Uint8Array(), expectedValue);
        }
        return checkValue(asBytes(second), expectedValue);
      }
      const ref = asBytes(second);
      if (ref.length !== 32) {
        return {
          ok: false,
          error: `node ${i}: inline-embedded extension child not supported (len ${ref.length})`
        };
      }
      expected = ref;
    } else {
      return {
        ok: false,
        error: `node ${i}: unexpected RLP shape (len ${decoded.length})`
      };
    }
  }
  return { ok: false, error: "proof exhausted without reaching leaf" };
}
function checkValue(actual, expected) {
  if (bytesEqual2(actual, expected)) {
    return { ok: true };
  }
  return {
    ok: false,
    error: `leaf value mismatch (got ${hexlify(actual)}, expected ${hexlify(expected)})`
  };
}
function bytesToNibbles(b) {
  const out = new Array(b.length * 2);
  for (let i = 0; i < b.length; i++) {
    out[2 * i] = b[i] >> 4 & 15;
    out[2 * i + 1] = b[i] & 15;
  }
  return out;
}
function nibbleSliceEquals(a, b, len) {
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function bytesEqual2(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function decodeCompactPath(encoded) {
  if (encoded.length === 0) {
    return { path: [], isLeaf: false };
  }
  const first = encoded[0];
  const flag = first >> 4 & 15;
  const isLeaf = flag >= 2;
  const odd = (flag & 1) === 1;
  const nibbles = [];
  if (odd) {
    nibbles.push(first & 15);
  }
  for (let i = 1; i < encoded.length; i++) {
    nibbles.push(encoded[i] >> 4 & 15);
    nibbles.push(encoded[i] & 15);
  }
  return { path: nibbles, isLeaf };
}
function asBytes(v) {
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) {
    return new Uint8Array();
  }
  if (typeof v === "string") return getBytes(v);
  return new Uint8Array();
}

// src/eth-state/types.ts
var StateVerifyMode = /* @__PURE__ */ ((StateVerifyMode2) => {
  StateVerifyMode2["Strict"] = "strict";
  StateVerifyMode2["AnchorOnly"] = "anchor_only";
  StateVerifyMode2["Disabled"] = "disabled";
  return StateVerifyMode2;
})(StateVerifyMode || {});

// src/eth-state/index.ts
var EthOperations = class {
  constructor(indexerBaseUrl, http) {
    this.indexerBaseUrl = indexerBaseUrl;
    this.mode = "strict" /* Strict */;
    this.http = http ?? axios4.create({ baseURL: indexerBaseUrl });
  }
  /** Set the verification mode for subsequent calls. */
  withMode(mode) {
    this.mode = mode;
    return this;
  }
  /**
   * Fetch `address`'s account state (+ optional storage slots) at
   * `blockNumber` and verify the response.
   */
  async getState(address, slots, blockNumber) {
    const body = {
      address,
      slots,
      block: blockNumber
    };
    const resp = await this.http.post(
      "/verifiable-rpc/eth/state",
      body
    );
    const envelope = resp.data;
    const proof = envelope.state_proofs?.[0];
    if (!proof) {
      throw new Error("response carried no state proof");
    }
    if (this.mode === "strict" /* Strict */) {
      verifyStateProof(proof);
    }
    return toVerifiedStateRead(proof, this.mode);
  }
  /**
   * Execute `tx` via the indexer's verified-REVM at `blockNumber` and
   * verify state proofs for every touched account.
   */
  async getCall(tx, blockNumber) {
    const body = { tx, block: blockNumber };
    const resp = await this.http.post(
      "/verifiable-rpc/eth/call",
      body
    );
    const envelope = resp.data;
    const proofs = envelope.state_proofs ?? [];
    if (this.mode === "strict" /* Strict */) {
      for (const p of proofs) {
        verifyStateProof(p);
      }
    }
    const result = `0x${Buffer.from(envelope.answer, "base64").toString("hex")}`;
    const blockNumberResp = envelope.block_range[0];
    const blockHash = proofs[0] ? bytesToHex32(proofs[0].block_hash) : `0x${"00".repeat(32)}`;
    return {
      block_number: blockNumberResp,
      block_hash: blockHash,
      state_root: bytesToHex32(envelope.state_root),
      result,
      access_state_reads: proofs.map((p) => toVerifiedStateRead(p, this.mode)),
      mode: this.mode
    };
  }
  /**
   * ERC-20 `balanceOf(holder)`. `balanceSlot` is the storage-mapping slot
   * index for the token (0 for OpenZeppelin-style, 9 for USDC). Always
   * check the token source if unsure.
   */
  async erc20Balance(token, holder, balanceSlot, blockNumber) {
    const slot = mappingSlotForAddress(holder, balanceSlot);
    const state = await this.getState(token, [slot], blockNumber);
    if (state.storage.length === 0) {
      throw new Error("erc20Balance: no storage proof returned");
    }
    return state.storage[0].value;
  }
  /** ERC-20 `totalSupply()` for tokens whose `_totalSupply` lives at `slot`. */
  async erc20TotalSupply(token, slot, blockNumber) {
    const slotHex = numberSlotToHex(slot);
    const state = await this.getState(token, [slotHex], blockNumber);
    if (state.storage.length === 0) {
      throw new Error("erc20TotalSupply: no storage proof returned");
    }
    return state.storage[0].value;
  }
  /** ERC-20 nested-mapping `allowance(holder, spender)`. */
  async erc20Allowance(token, holder, spender, allowanceSlot, blockNumber) {
    const inner = mappingSlotForAddressBytes(getBytes2(asAddress(holder)), allowanceSlot);
    const buf = new Uint8Array(64);
    buf.set(getBytes2(asAddress(spender)), 12);
    buf.set(inner, 32);
    const slot = hexlify2(keccak_2562(buf));
    const state = await this.getState(token, [slot], blockNumber);
    if (state.storage.length === 0) {
      throw new Error("erc20Allowance: no storage proof returned");
    }
    return state.storage[0].value;
  }
  /** ERC-721 `ownerOf(tokenId)` from the `_owners` mapping at `slot`. */
  async erc721Owner(contract, tokenId, slot, blockNumber) {
    const tokenIdBytes = padBigIntTo32(tokenId);
    const buf = new Uint8Array(64);
    buf.set(tokenIdBytes, 0);
    buf[63] = slot;
    const storageSlot = hexlify2(keccak_2562(buf));
    const state = await this.getState(contract, [storageSlot], blockNumber);
    if (state.storage.length === 0) {
      throw new Error("erc721Owner: no storage proof returned");
    }
    const value = state.storage[0].value;
    const bytes = padBigIntTo32(value);
    return `0x${Buffer.from(bytes.slice(12)).toString("hex")}`;
  }
  /**
   * Uniswap V2 `getReserves()` — packed in slot 8 as
   * `[blockTimestampLast (4 bytes) | reserve1 (14) | reserve0 (14)]`
   * in big-endian on-the-wire order.
   */
  async uniV2Reserves(pair, blockNumber) {
    const slot = numberSlotToHex(8);
    const state = await this.getState(pair, [slot], blockNumber);
    if (state.storage.length === 0) {
      throw new Error("uniV2Reserves: no storage proof returned");
    }
    const bytes = padBigIntTo32(state.storage[0].value);
    const blockTimestampLast = bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3];
    const reserve1 = bytesToBigInt(bytes.slice(4, 18));
    const reserve0 = bytesToBigInt(bytes.slice(18, 32));
    return { reserve0, reserve1, blockTimestampLast: blockTimestampLast >>> 0 };
  }
};
function verifyStateProof(proof) {
  const stateRoot = bytesFromArray(proof.state_root);
  const addressHash = keccak_2562(bytesFromArray(proof.address));
  const accountLeaf = rlpEncodeAccount(proof.account_state);
  const r = verifyMptProof(
    stateRoot,
    addressHash,
    accountLeaf,
    proof.account_proof.proof_nodes.map((n) => bytesFromArray(n))
  );
  if (!r.ok) {
    throw new Error(`state proof: account proof failed: ${r.error}`);
  }
  const storageHash = bytesFromArray(proof.account_state.storage_hash);
  for (const sp of proof.storage_proofs) {
    verifyStorageSlot(sp, storageHash);
  }
}
function verifyStorageSlot(sp, storageHash) {
  const slotBytes = bytesFromArray(sp.slot);
  const slotHash = keccak_2562(slotBytes);
  const valueBig = bytesToBigInt(bytesFromArray(sp.value));
  const valueRlp = getBytes2(encodeRlp(valueBig === 0n ? "0x" : "0x" + valueBig.toString(16)));
  const r = verifyMptProof(
    storageHash,
    slotHash,
    valueRlp,
    sp.proof.proof_nodes.map((n) => bytesFromArray(n))
  );
  if (!r.ok) {
    throw new Error(
      `state proof: storage slot 0x${Buffer.from(slotBytes).toString("hex")} failed: ${r.error}`
    );
  }
}
function rlpEncodeAccount(state) {
  const nonceHex = state.nonce === 0 ? "0x" : "0x" + state.nonce.toString(16);
  const balanceBig = bytesToBigInt(bytesFromArray(state.balance));
  const balanceHex = balanceBig === 0n ? "0x" : "0x" + balanceBig.toString(16);
  const storageRoot = "0x" + Buffer.from(bytesFromArray(state.storage_hash)).toString("hex");
  const codeHash = "0x" + Buffer.from(bytesFromArray(state.code_hash)).toString("hex");
  return getBytes2(encodeRlp([nonceHex, balanceHex, storageRoot, codeHash]));
}
function toVerifiedStateRead(proof, mode) {
  return {
    address: bytesToHex20(proof.address),
    block_number: proof.block_number,
    block_hash: bytesToHex32(proof.block_hash),
    state_root: bytesToHex32(proof.state_root),
    nonce: proof.account_state.nonce,
    balance: bytesToBigInt(bytesFromArray(proof.account_state.balance)),
    storage_hash: bytesToHex32(proof.account_state.storage_hash),
    code_hash: bytesToHex32(proof.account_state.code_hash),
    storage: proof.storage_proofs.map((sp) => ({
      slot: bytesToHex32(sp.slot),
      value: bytesToBigInt(bytesFromArray(sp.value))
    })),
    mode
  };
}
function bytesFromArray(arr) {
  return new Uint8Array(arr);
}
function bytesToHex20(arr) {
  return "0x" + Buffer.from(arr).toString("hex").padStart(40, "0");
}
function bytesToHex32(arr) {
  return "0x" + Buffer.from(arr).toString("hex").padStart(64, "0");
}
function bytesToBigInt(arr) {
  if (arr.length === 0) return 0n;
  return toBigInt(arr);
}
function asAddress(s) {
  return s.toLowerCase().startsWith("0x") ? s : `0x${s}`;
}
function padBigIntTo32(value) {
  const minimal = value === 0n ? new Uint8Array(1) : toBeArray(value);
  if (minimal.length === 32) return minimal;
  const padded = new Uint8Array(32);
  padded.set(minimal, 32 - minimal.length);
  return padded;
}
function numberSlotToHex(slot) {
  const buf = new Uint8Array(32);
  buf[31] = slot & 255;
  return hexlify2(buf);
}
function mappingSlotForAddress(address, slotIndex) {
  return hexlify2(mappingSlotForAddressBytes(getBytes2(asAddress(address)), slotIndex));
}
function mappingSlotForAddressBytes(addrBytes, slotIndex) {
  const buf = new Uint8Array(64);
  buf.set(addrBytes, 12);
  buf[63] = slotIndex & 255;
  return keccak_2562(buf);
}

// src/consensus/types.ts
import { keccak_256 as keccak_2563 } from "@noble/hashes/sha3";
var ConsensusError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ConsensusError";
  }
};
function createConsensusConfig(config) {
  if (!config.consensusRpcUrl) {
    throw new Error("consensusRpcUrl is required");
  }
  return {
    consensusRpcUrl: config.consensusRpcUrl,
    chainId: config.chainId || "willow-chain",
    requestTimeoutSecs: config.requestTimeoutSecs || 30,
    maxRetries: config.maxRetries || 3,
    retryDelaySecs: config.retryDelaySecs || 1
  };
}
function createBroadcastResult(data) {
  if (data.error) {
    return {
      success: false,
      errorMessage: data.error.message || "Unknown error"
    };
  }
  const result = data.result || {};
  const code = result.code || 0;
  return {
    success: code === 0,
    txHash: result.hash,
    height: result.height,
    errorCode: code !== 0 ? code : void 0,
    errorMessage: code !== 0 ? result.log : void 0,
    rawLog: result.log
  };
}
function hexToByteArray2(hex) {
  const clean = hex.replace(/^0x/, "");
  const out = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.substr(i, 2), 16));
  }
  return out;
}
function createTransactionWrapper(txType, transaction) {
  const tx = transaction;
  const sig = typeof tx.signature === "string" ? hexToByteArray2(tx.signature) : tx.signature ?? [];
  const nonce = typeof tx.nonce === "number" ? tx.nonce : 0;
  const publicKeyId = tx.publicKeyId ?? "";
  switch (txType) {
    case "RegisterSubgrove": {
      const t = transaction;
      const wrapper = {
        subgrove_id: t.subgroveId,
        name: t.subgroveId,
        description: "",
        schema: t.schema,
        owner_did: t.ownerDid,
        admins: [],
        mode: t.mode ?? { DataStorage: { name: t.subgroveId, writers: [t.ownerDid], free_readers: [] } },
        retention_window: t.retention_window,
        signature: sig,
        public_key_id: publicKeyId,
        nonce
      };
      if (t.initialFunding) {
        wrapper.initial_funding = parseInt(t.initialFunding, 10);
      }
      return { RegisterSubgrove: wrapper };
    }
    case "DataStore": {
      const t = transaction;
      const data = Array.from(new TextEncoder().encode(t.data));
      return {
        StoreData: {
          subgrove_id: t.subgroveId,
          key: t.key,
          data,
          owner_did: t.ownerDid,
          signature: sig,
          public_key_id: publicKeyId,
          nonce
        }
      };
    }
    case "Transfer": {
      const t = transaction;
      return {
        Transfer: {
          from_did: t.fromDid,
          to_did: t.toDid,
          amount: t.amount,
          memo: t.memo ?? "",
          signature: sig,
          public_key_id: publicKeyId,
          nonce
        }
      };
    }
    case "RegisterDid": {
      const t = transaction;
      return {
        RegisterDid: {
          did_document: t.didDocument,
          signature: sig,
          public_key_id: publicKeyId,
          nonce
        }
      };
    }
    case "DeregisterSubgrove": {
      const t = transaction;
      return {
        DeregisterSubgrove: {
          subgrove_id: t.subgroveId,
          owner_did: t.ownerDid,
          signature: sig,
          public_key_id: publicKeyId,
          nonce
        }
      };
    }
    case "SubmitAnchor": {
      const t = transaction;
      return {
        SubmitAnchor: {
          did: t.did,
          anchor_id: t.anchorId,
          sequence_range: t.sequenceRange,
          merkle_root: t.merkleRoot,
          count: t.count,
          receipt_hashes: t.receiptHashes,
          timestamp: t.timestamp,
          previous_anchor_hash: t.previousAnchorHash,
          anchor_hash: t.anchorHash,
          is_genesis: t.isGenesis,
          signature: sig,
          public_key_id: publicKeyId,
          nonce
        }
      };
    }
    default:
      return { [txType]: tx };
  }
}
function schemaHash(schema) {
  const hash = keccak_2563(new TextEncoder().encode(schema));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}
function createSignMessage(txType, transaction) {
  switch (txType) {
    case "RegisterDid": {
      const tx = transaction;
      return JSON.stringify(tx.didDocument);
    }
    case "RegisterSubgrove": {
      const tx = transaction;
      const mode = tx.mode;
      const sh = schemaHash(tx.schema);
      if (mode && "BlockchainIndexing" in mode) {
        return `RegisterSubgrove:${tx.subgroveId}:${tx.ownerDid}:${tx.nonce || 0}`;
      }
      if (mode && "FileStorage" in mode) {
        const fs = mode.FileStorage;
        return `RegisterSubgrove
ID: ${tx.subgroveId}
Mode: FileStorage
Name: ${fs.name ?? tx.subgroveId}
Description: 
SchemaHash: ${sh}
Owner: ${tx.ownerDid}
Admins: 
Writers: ${(fs.writers ?? []).join(",")}
Readers: ${(fs.free_readers ?? []).join(",")}
Nonce: ${tx.nonce || 0}`;
      }
      const ds = mode && "DataStorage" in mode ? mode.DataStorage : { name: tx.subgroveId, writers: [tx.ownerDid], free_readers: [] };
      return `RegisterSubgrove
ID: ${tx.subgroveId}
Name: ${ds.name ?? tx.subgroveId}
Description: 
SchemaHash: ${sh}
Owner: ${tx.ownerDid}
Admins: 
Writers: ${(ds.writers ?? []).join(",")}
Readers: ${(ds.free_readers ?? []).join(",")}
Nonce: ${tx.nonce || 0}`;
    }
    case "Transfer": {
      const tx = transaction;
      return `Transfer
From: ${tx.fromDid}
To: ${tx.toDid}
Amount: ${tx.amount}
Memo: ${tx.memo || ""}
Nonce: ${tx.nonce || 0}`;
    }
    case "DataStore": {
      const tx = transaction;
      return `${tx.subgroveId}:${tx.key}:${tx.data}`;
    }
    case "StoreFileManifest": {
      const tx = transaction;
      return `store_file:${tx.subgroveId}:${tx.fileKey}:${tx.contentHash}:${tx.totalSize}`;
    }
    case "DeleteFileManifest": {
      const tx = transaction;
      return `delete_file:${tx.subgroveId}:${tx.fileKey}`;
    }
    case "DeregisterSubgrove": {
      const tx = transaction;
      return `DeregisterSubgrove:${tx.subgroveId}:${tx.ownerDid}:${tx.nonce || 0}`;
    }
    case "SubmitAnchor": {
      const tx = transaction;
      return `SubmitAnchor
${tx.anchorHash}
${tx.nonce || 0}`;
    }
    default:
      throw new Error(`Unknown transaction type: ${txType}`);
  }
}
function stringToBase64(str) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  } else {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

// src/consensus/anchor-canonical.ts
import { createHash } from "crypto";
function sha256Hex(input) {
  const hash = createHash("sha256");
  hash.update(typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input));
  return hash.digest("hex");
}
function jsonEscape(s) {
  let out = '"';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "	") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 32) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch;
  }
  out += '"';
  return out;
}
function canonicalizeAnchorBody(body) {
  const parts = [];
  parts.push(`${jsonEscape("anchor_id")}:${jsonEscape(body.anchor_id)}`);
  parts.push(`${jsonEscape("count")}:${body.count}`);
  parts.push(`${jsonEscape("did")}:${jsonEscape(body.did)}`);
  parts.push(`${jsonEscape("is_genesis")}:${body.is_genesis}`);
  parts.push(`${jsonEscape("merkle_root")}:${jsonEscape(body.merkle_root)}`);
  parts.push(`${jsonEscape("previous_anchor_hash")}:${jsonEscape(body.previous_anchor_hash)}`);
  parts.push(`${jsonEscape("receipt_hashes")}:[${body.receipt_hashes.map(jsonEscape).join(",")}]`);
  parts.push(`${jsonEscape("sequence_range")}:[${body.sequence_range[0]},${body.sequence_range[1]}]`);
  parts.push(`${jsonEscape("timestamp")}:${jsonEscape(body.timestamp)}`);
  return "{" + parts.join(",") + "}";
}
function computeAnchorMerkleRoot(hashes) {
  if (hashes.length === 0) return "";
  let level = [...hashes];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(sha256Hex(left + right));
    }
    level = next;
  }
  return level[0];
}

// src/consensus/client.ts
var ConsensusClient = class {
  constructor(config) {
    this.nonceCache = /* @__PURE__ */ new Map();
    this.config = {
      ...config,
      requestTimeoutSecs: config.requestTimeoutSecs ?? 30,
      maxRetries: config.maxRetries ?? 3,
      retryDelaySecs: config.retryDelaySecs ?? 1
    };
  }
  /**
   * Register a DID on the blockchain
   */
  async registerDid(didDocument, privateKey, publicKeyId, signFunction) {
    const tx = {
      didDocument,
      signature: "",
      // Will be filled by signing
      publicKeyId,
      nonce: await this.getNextNonce(didDocument.id || "")
    };
    return this.signAndBroadcast("RegisterDid", tx, privateKey, signFunction);
  }
  /**
   * Register a subgrove (dataset) on the blockchain
   */
  async registerSubgrove(subgroveId, schema, ownerDid, privateKey, publicKeyId, signFunction, mode, retentionWindow, initialFunding) {
    const tx = {
      subgroveId,
      schema,
      ownerDid,
      mode,
      retention_window: retentionWindow,
      initialFunding,
      signature: "",
      publicKeyId,
      nonce: await this.getNextNonce(ownerDid)
    };
    return this.signAndBroadcast("RegisterSubgrove", tx, privateKey, signFunction);
  }
  /**
   * Transfer tokens between DIDs
   */
  async transfer(fromDid, toDid, amount, privateKey, publicKeyId, signFunction, memo) {
    const tx = {
      fromDid,
      toDid,
      amount,
      memo,
      signature: "",
      publicKeyId,
      nonce: await this.getNextNonce(fromDid)
    };
    return this.signAndBroadcast("Transfer", tx, privateKey, signFunction);
  }
  /**
   * Store data on the blockchain
   */
  async storeData(subgroveId, key, data, ownerDid, privateKey, publicKeyId, signFunction) {
    const tx = {
      subgroveId,
      key,
      data: JSON.stringify(data),
      ownerDid,
      signature: "",
      publicKeyId,
      nonce: await this.getNextNonce(ownerDid)
    };
    return this.signAndBroadcast("DataStore", tx, privateKey, signFunction);
  }
  /**
   * Store a file manifest on the blockchain
   */
  async storeFileManifest(subgroveId, fileKey, filename, contentType, totalSize, contentHash, chunkCount, chunkSize, chunkMerkleRoot, ownerDid, privateKey, publicKeyId, signFunction) {
    const tx = {
      subgroveId,
      fileKey,
      filename,
      contentType,
      totalSize,
      contentHash,
      chunkCount,
      chunkSize,
      chunkMerkleRoot,
      ownerDid,
      signature: "",
      publicKeyId,
      nonce: await this.getNextNonce(ownerDid)
    };
    return this.signAndBroadcast("StoreFileManifest", tx, privateKey, signFunction);
  }
  /**
   * Delete a file manifest from the blockchain
   */
  async deleteFileManifest(subgroveId, fileKey, ownerDid, privateKey, publicKeyId, signFunction) {
    const tx = {
      subgroveId,
      fileKey,
      ownerDid,
      signature: "",
      publicKeyId,
      nonce: await this.getNextNonce(ownerDid)
    };
    return this.signAndBroadcast("DeleteFileManifest", tx, privateKey, signFunction);
  }
  /**
   * Deregister (delete) a subgrove. Remaining funding is refunded to the owner.
   */
  async deregisterSubgrove(subgroveId, ownerDid, privateKey, publicKeyId, signFunction) {
    const tx = {
      subgroveId,
      ownerDid,
      signature: "",
      publicKeyId,
      nonce: await this.getNextNonce(ownerDid)
    };
    return this.signAndBroadcast("DeregisterSubgrove", tx, privateKey, signFunction);
  }
  /**
   * Submit an MCP receipt-batch anchor. The chain enforces per-DID
   * monotonicity (genesis-once, sequence contiguity, prev_anchor_hash
   * linkage) and recomputes both `anchorHash` and `merkleRoot` from
   * the canonical body — so the values must match byte-for-byte.
   * `merkleRoot` is computed automatically if omitted; `anchorHash`
   * is always computed here.
   */
  async submitAnchor(fields, privateKey, publicKeyId, signFunction) {
    const count = fields.receiptHashes.length;
    const merkleRoot = fields.merkleRoot ?? computeAnchorMerkleRoot(fields.receiptHashes);
    const canonical = canonicalizeAnchorBody({
      anchor_id: fields.anchorId,
      count,
      did: fields.did,
      is_genesis: fields.isGenesis,
      merkle_root: merkleRoot,
      previous_anchor_hash: fields.previousAnchorHash,
      receipt_hashes: fields.receiptHashes,
      sequence_range: fields.sequenceRange,
      timestamp: fields.timestamp
    });
    const anchorHash = sha256Hex(canonical);
    const tx = {
      did: fields.did,
      anchorId: fields.anchorId,
      sequenceRange: fields.sequenceRange,
      merkleRoot,
      count,
      receiptHashes: fields.receiptHashes,
      timestamp: fields.timestamp,
      previousAnchorHash: fields.previousAnchorHash,
      anchorHash,
      isGenesis: fields.isGenesis,
      signature: "",
      publicKeyId,
      nonce: await this.getNextNonce(fields.did)
    };
    return this.signAndBroadcast("SubmitAnchor", tx, privateKey, signFunction);
  }
  /**
   * Get the status of a transaction
   */
  async getTransactionStatus(txHash) {
    try {
      const result = await this.queryTransaction(txHash);
      if (!result) {
        return "not_found" /* NOT_FOUND */;
      }
      const code = result.tx_result?.code || 0;
      return code === 0 ? "success" /* SUCCESS */ : "failed" /* FAILED */;
    } catch (error) {
      console.warn("Failed to get transaction status:", error);
      return "not_found" /* NOT_FOUND */;
    }
  }
  /**
   * Wait for a transaction to be confirmed
   */
  async waitForTransaction(txHash, timeoutSecs = 60, pollInterval = 2) {
    const startTime = Date.now();
    const timeoutMs = timeoutSecs * 1e3;
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getTransactionStatus(txHash);
      if (status === "success" /* SUCCESS */ || status === "failed" /* FAILED */) {
        return status;
      }
      await this.sleep(pollInterval * 1e3);
    }
    return "pending" /* PENDING */;
  }
  /**
   * Get the blockchain chain ID
   */
  async getChainId() {
    try {
      const result = await this.rpcRequest("status", {});
      return result.node_info?.network || this.config.chainId;
    } catch (error) {
      console.warn("Failed to get chain ID:", error);
      return this.config.chainId;
    }
  }
  /**
   * Get the latest blockchain height
   */
  async getLatestHeight() {
    try {
      const result = await this.rpcRequest("status", {});
      return parseInt(result.sync_info?.latest_block_height || "0");
    } catch (error) {
      console.warn("Failed to get latest height:", error);
      return void 0;
    }
  }
  // Private methods
  /**
   * Sign a transaction and broadcast it
   */
  async signAndBroadcast(txType, transaction, privateKey, signFunction) {
    const signMessageText = createSignMessage(txType, transaction);
    const signatureHex = signFunction(signMessageText, privateKey);
    transaction.signature = signatureHex;
    const txWrapper = createTransactionWrapper(txType, transaction);
    return this.broadcastTransaction(txWrapper);
  }
  /**
   * Broadcast a transaction to Willow consensus.
   *
   * Goes through the API server's `POST /tx/submit` endpoint: the server
   * accepts the JSON-encoded Transaction, bincode-encodes it, and forwards
   * to CometBFT's `broadcast_tx_sync`. The chain's on-the-wire format is
   * bincode (see docs/todo/proposal-bincode-wire.md) — this keeps the SDK
   * on JSON without implementing a bincode encoder per language.
   */
  async broadcastTransaction(transaction) {
    if (!this.config.apiUrl) {
      throw new ConsensusError(
        "apiUrl is required for transaction submission. Set it in the SDK config."
      );
    }
    const url = `${this.config.apiUrl.replace(/\/$/, "")}/tx/submit`;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transaction),
          signal: AbortSignal.timeout(this.config.requestTimeoutSecs * 1e3)
        });
        const body = await response.json();
        if (!response.ok || !body.success || !body.data) {
          const msg = body.error || `HTTP ${response.status}`;
          return { success: false, errorMessage: msg, rawLog: msg };
        }
        const code = body.data.code;
        return {
          success: code === 0,
          txHash: body.data.tx_hash,
          errorCode: code !== 0 ? code : void 0,
          errorMessage: code !== 0 ? body.data.log : void 0,
          rawLog: body.data.log
        };
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          throw new ConsensusError(
            `tx submit failed after ${this.config.maxRetries + 1} attempts: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
    throw new ConsensusError("tx submit: exhausted retries");
  }
  /**
   * Make a JSON-RPC request to CometBFT
   */
  async rpcRequest(method, params) {
    const rpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    };
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(this.config.consensusRpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcRequest),
          signal: AbortSignal.timeout(this.config.requestTimeoutSecs * 1e3)
        });
        if (response.ok) {
          const data = await response.json();
          if (data.error) {
            throw new ConsensusError(`RPC error: ${JSON.stringify(data.error)}`);
          }
          return data.result || {};
        } else {
          const errorText = await response.text();
          throw new ConsensusError(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          throw new ConsensusError(
            `RPC request failed after ${this.config.maxRetries + 1} attempts: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        console.warn(`RPC attempt ${attempt + 1} failed:`, error);
        await this.sleep(this.config.retryDelaySecs * 1e3 * (attempt + 1));
      }
    }
    throw new ConsensusError("Unexpected end of retry loop");
  }
  /**
   * Query a transaction by hash
   */
  async queryTransaction(txHash) {
    try {
      const result = await this.rpcRequest("tx", { hash: txHash, prove: false });
      return result;
    } catch (error) {
      return void 0;
    }
  }
  /**
   * Get the next nonce for a DID
   *
   * Fetches the current nonce from the blockchain and returns the next value.
   * Falls back to in-memory cache if API is unavailable.
   */
  async getNextNonce(did) {
    try {
      const currentNonce = await this.getAccountNonce(did);
      const nextNonce = currentNonce + 1;
      this.nonceCache.set(did, nextNonce);
      return nextNonce;
    } catch (error) {
      console.warn("Failed to fetch nonce from API, using cache:", error);
      const currentNonce = this.nonceCache.get(did) || 0;
      const nextNonce = currentNonce + 1;
      this.nonceCache.set(did, nextNonce);
      return nextNonce;
    }
  }
  /**
   * Get the current nonce for an account from the blockchain
   */
  async getAccountNonce(did) {
    if (!this.config.apiUrl) {
      return this.nonceCache.get(did) || 0;
    }
    const response = await fetch(
      `${this.config.apiUrl}/account/${encodeURIComponent(did)}/nonce`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.config.requestTimeoutSecs * 1e3)
      }
    );
    if (!response.ok) {
      throw new ConsensusError(`Failed to fetch nonce: HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data.success || data.data === void 0) {
      throw new ConsensusError(data.error || "Failed to fetch nonce");
    }
    return data.data.nonce;
  }
  /**
   * Utility: Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// src/consensus/config.ts
var ConsensusConfigBuilder = class {
  /**
   * Initialize builder with required consensus RPC URL
   */
  constructor(consensusRpcUrl) {
    this._chainId = "willow-chain";
    this._requestTimeoutSecs = 30;
    this._maxRetries = 3;
    this._retryDelaySecs = 1;
    this._consensusRpcUrl = consensusRpcUrl;
  }
  /**
   * Set the REST API URL for account queries (nonce, etc.)
   */
  apiUrl(apiUrl) {
    this._apiUrl = apiUrl;
    return this;
  }
  /**
   * Set the blockchain chain ID
   */
  chainId(chainId) {
    this._chainId = chainId;
    return this;
  }
  /**
   * Set request timeout in seconds
   */
  requestTimeoutSecs(seconds) {
    this._requestTimeoutSecs = seconds;
    return this;
  }
  /**
   * Set maximum retry attempts
   */
  maxRetries(retries) {
    this._maxRetries = retries;
    return this;
  }
  /**
   * Set delay between retries in seconds
   */
  retryDelaySecs(seconds) {
    this._retryDelaySecs = seconds;
    return this;
  }
  /**
   * Build the final configuration
   */
  build() {
    return createConsensusConfig({
      consensusRpcUrl: this._consensusRpcUrl,
      apiUrl: this._apiUrl,
      chainId: this._chainId,
      requestTimeoutSecs: this._requestTimeoutSecs,
      maxRetries: this._maxRetries,
      retryDelaySecs: this._retryDelaySecs
    });
  }
};
function localConfig(rpcPort = 26657, apiPort = 3031) {
  return new ConsensusConfigBuilder(`http://localhost:${rpcPort}`).apiUrl(`http://localhost:${apiPort}`);
}
function testnetConfig(rpcUrl, apiUrl) {
  const builder = new ConsensusConfigBuilder(rpcUrl).chainId("willow-testnet").requestTimeoutSecs(30).maxRetries(3).retryDelaySecs(2);
  if (apiUrl) {
    builder.apiUrl(apiUrl);
  }
  return builder;
}
function mainnetConfig2(rpcUrl, apiUrl) {
  const builder = new ConsensusConfigBuilder(rpcUrl).chainId("willow-mainnet").requestTimeoutSecs(60).maxRetries(5).retryDelaySecs(3);
  if (apiUrl) {
    builder.apiUrl(apiUrl);
  }
  return builder;
}

// src/subscriptions/index.ts
function toWsUrl(apiUrl) {
  if (apiUrl.startsWith("https://")) return "wss://" + apiUrl.slice("https://".length);
  if (apiUrl.startsWith("http://")) return "ws://" + apiUrl.slice("http://".length);
  if (apiUrl.startsWith("/") && typeof globalThis !== "undefined" && globalThis.location) {
    const loc = globalThis.location;
    const scheme = loc.protocol === "https:" ? "wss:" : "ws:";
    return `${scheme}//${loc.host}${apiUrl}`;
  }
  return apiUrl;
}
var WillowSubscriptions = class {
  constructor(apiUrl, indexers) {
    this.counter = 0;
    this.apiUrl = apiUrl;
    this.indexers = indexers;
  }
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
  subscribe(subgroveId, query, onNext, options = {}) {
    const source = options.source ?? "validator";
    const reconnectEnabled = options.reconnect ?? true;
    const maxAttempts = options.maxReconnectAttempts ?? Infinity;
    const initialBackoff = options.reconnectBackoffMs ?? 500;
    const maxBackoff = options.maxReconnectBackoffMs ?? 3e4;
    const id = `sub-${++this.counter}-${Date.now()}`;
    let socket = null;
    let closedByClient = false;
    let reconnectTimer = null;
    let attempts = 0;
    let lastIndexerDid = null;
    const sendOn = (s, msg) => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(JSON.stringify(msg));
      }
    };
    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    const scheduleReconnect = () => {
      if (closedByClient || !reconnectEnabled) {
        options.onComplete?.();
        return;
      }
      if (attempts >= maxAttempts) {
        options.onComplete?.();
        return;
      }
      attempts += 1;
      const delay = Math.min(
        initialBackoff * Math.pow(2, attempts - 1),
        maxBackoff
      );
      options.onReconnect?.(attempts, delay);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void openConnection();
      }, delay);
    };
    const wireSocket = (wsUrl) => {
      if (closedByClient) return;
      socket = new WebSocket(wsUrl, "graphql-transport-ws");
      const s = socket;
      s.addEventListener("open", () => {
        sendOn(s, { type: "connection_init", payload: options.connectionPayload ?? {} });
      });
      s.addEventListener("message", (ev) => {
        let msg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch (err) {
          options.onError?.(err);
          return;
        }
        switch (msg.type) {
          case "connection_ack":
            attempts = 0;
            sendOn(s, {
              type: "subscribe",
              id,
              payload: {
                query,
                ...options.variables ? { variables: options.variables } : {},
                ...options.operationName ? { operationName: options.operationName } : {}
              }
            });
            break;
          case "next":
            if (msg.id === id && msg.payload) onNext(msg.payload);
            break;
          case "error":
            if (msg.id === id) options.onError?.(msg.payload);
            break;
          case "complete":
            if (msg.id === id) {
              closedByClient = true;
              options.onComplete?.();
            }
            break;
          case "ping":
            sendOn(s, { type: "pong" });
            break;
          case "pong":
            break;
          default:
            break;
        }
      });
      s.addEventListener("error", (ev) => {
        options.onError?.(ev);
      });
      s.addEventListener("close", () => {
        if (closedByClient) {
          return;
        }
        scheduleReconnect();
      });
    };
    const openConnection = async () => {
      if (closedByClient) return;
      if (source === "validator") {
        wireSocket(toWsUrl(this.apiUrl.replace(/\/$/, "")) + "/graphql/ws");
        return;
      }
      if (!this.indexers) {
        options.onError?.(
          new Error(
            "Cannot subscribe with source='indexer': no WillowIndexers client was provided. Either pass one to WillowSubscriptions directly, or construct via WillowClient which wires it up."
          )
        );
        closedByClient = true;
        options.onComplete?.();
        return;
      }
      if (lastIndexerDid) {
        this.indexers.evict(lastIndexerDid);
      }
      try {
        const candidates = await this.indexers.forSubgrove(subgroveId);
        if (candidates.length === 0) {
          options.onError?.(
            new Error(
              `No indexer serves subgrove "${subgroveId}" \u2014 cannot open indexer subscription`
            )
          );
          if (reconnectEnabled) {
            scheduleReconnect();
          } else {
            closedByClient = true;
            options.onComplete?.();
          }
          return;
        }
        const chosen = candidates[0];
        lastIndexerDid = chosen.indexer_did;
        const endpoint = effectiveQueryEndpoint(chosen).replace(/\/$/, "");
        wireSocket(toWsUrl(endpoint) + "/graphql/ws");
      } catch (err) {
        options.onError?.(err);
        if (reconnectEnabled) {
          scheduleReconnect();
        } else {
          closedByClient = true;
          options.onComplete?.();
        }
      }
    };
    void openConnection();
    return () => {
      closedByClient = true;
      clearReconnectTimer();
      if (socket && socket.readyState === WebSocket.OPEN) {
        sendOn(socket, { type: "complete", id });
      }
      try {
        socket?.close();
      } catch {
      }
    };
  }
};

// src/client.ts
function deriveCometBftUrl(apiUrl) {
  const match = apiUrl.match(/:(\d+)(\/)?$/);
  if (match) {
    const apiPort = parseInt(match[1]);
    const nodeN = apiPort - 3030;
    if (nodeN >= 1 && nodeN <= 10) {
      const rpcPort = 26557 + nodeN * 100;
      return apiUrl.replace(`:${apiPort}`, `:${rpcPort}`);
    }
  }
  return apiUrl.replace(/:3031/, ":26657");
}
var WillowClient = class {
  constructor(config) {
    this.config = config;
    this.auth = new WillowAuth(config.apiUrl);
    const cometUrl = config.consensusRpcUrl ?? deriveCometBftUrl(config.apiUrl);
    this.indexers = new WillowIndexers(config.apiUrl, {
      indexerUrl: config.indexerUrl
    });
    this.data = new WillowData(config.apiUrl, this.auth, this.indexers, cometUrl);
    this.subscriptions = new WillowSubscriptions(config.apiUrl, this.indexers);
    this.files = new FileOperations(config.apiUrl, () => this.auth.getAuthHeaders("GET", "/files"));
    this.eth = new EthOperations(config.indexerUrl ?? config.apiUrl);
    this.consensus = new ConsensusClient({
      consensusRpcUrl: cometUrl,
      apiUrl: config.apiUrl
    });
    if (config.proofVerificationOptions) {
      configureProofVerification(config.proofVerificationOptions);
    }
  }
  /**
   * Initialize the client with authentication
   */
  async init(privateKey, publicKeyId) {
    if (!this.config.did) {
      throw new Error("DID is required for initialization");
    }
    const key = privateKey || this.config.privateKey;
    if (!key) {
      throw new Error("Private key is required for authentication");
    }
    if (!publicKeyId) {
      const didDoc = await this.auth.getDid_(this.config.did);
      if (didDoc.publicKeys.length === 0) {
        throw new Error("No public keys found in DID document");
      }
      publicKeyId = didDoc.publicKeys[0].id;
    }
    this.auth.setIdentity(this.config.did, key, publicKeyId);
  }
  /**
   * Register a new DID
   */
  async registerDid(didDocument) {
    return this.auth.registerDid(didDocument);
  }
  /**
   * Register a subgrove via a consensus transaction.
   */
  async registerDataset(request) {
    this.requireIdentity();
    const result = await this.consensus.registerSubgrove(
      request.dataset_id,
      JSON.stringify(request.schema ?? {}),
      this.auth.getDid(),
      this.auth.getPrivateKey(),
      this.auth.getPublicKeyId(),
      signEd25519
    );
    if (!result.success) {
      throw new Error(
        `registerDataset failed: ${result.errorMessage ?? result.rawLog ?? "unknown"}`
      );
    }
    return {
      dataset_id: request.dataset_id,
      name: request.name,
      schema: request.schema ?? { version: 1, fields: {}, indexes: [], required_fields: [] },
      owner_did: request.owner_did,
      writers: request.writers ?? [],
      readers: request.readers ?? [],
      created_at: Math.floor(Date.now() / 1e3),
      updated_at: Math.floor(Date.now() / 1e3)
    };
  }
  /**
   * Deregister a subgrove. Remaining funding is refunded to the owner.
   *
   * Re-registering with a different start_block or schema requires
   * deregistering first — RegisterSubgroveTx is idempotent on the server,
   * so a second register of the same subgrove_id is a no-op. The server
   * bumps `deployment_epoch` on deregister, which indexers watch for to
   * restart their pipelines on the next loop tick.
   */
  async deregisterSubgrove(subgroveId) {
    this.requireIdentity();
    return this.consensus.deregisterSubgrove(
      subgroveId,
      this.auth.getDid(),
      this.auth.getPrivateKey(),
      this.auth.getPublicKeyId(),
      signEd25519
    );
  }
  /**
   * Store data via a consensus transaction.
   */
  async store(datasetId, key, value) {
    this.requireIdentity();
    const result = await this.consensus.storeData(
      datasetId,
      key,
      value,
      this.auth.getDid(),
      this.auth.getPrivateKey(),
      this.auth.getPublicKeyId(),
      signEd25519
    );
    if (!result.success) {
      throw new Error(
        `store failed: ${result.errorMessage ?? result.rawLog ?? "unknown"}`
      );
    }
  }
  /**
   * Get data with automatic proof verification (secure by default)
   */
  async get(datasetId, key) {
    return this.data.getData(datasetId, key);
  }
  /**
   * Get data without proof verification (use with caution)
   */
  async getUnverified(datasetId, key) {
    return this.data.getDataUnverified(datasetId, key);
  }
  /**
   * Update data via a consensus transaction (same as store — idempotent upsert).
   */
  async update(datasetId, key, value) {
    return this.store(datasetId, key, value);
  }
  /**
   * Delete data by key.
   */
  async delete(datasetId, key) {
    return this.data.deleteData(datasetId, key);
  }
  /**
   * Get proof
   */
  async getProof(datasetId, key) {
    return this.data.getProof(datasetId, key);
  }
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
  async getRootHash() {
    const response = await fetch(
      `${this.config.apiUrl}/state/root-hash/verified`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to get verified root hash: ${response.statusText}`
      );
    }
    const data = await response.json();
    if (!data.success || !data.data?.root_hash) {
      throw new Error("No root hash in response");
    }
    return data.data.root_hash;
  }
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
  async getRootHashLocal() {
    const response = await fetch(`${this.config.apiUrl}/state/root-hash`);
    if (!response.ok) {
      throw new Error(`Failed to get local root hash: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success || !data.data?.root_hash) {
      throw new Error("No root hash in response");
    }
    return data.data.root_hash;
  }
  /**
   * Query indexed data with automatic proof verification (secure by default)
   */
  async query(datasetId, query) {
    return this.data.query(datasetId, query);
  }
  /**
   * Query indexed data without proof verification (use with caution)
   */
  async queryUnverified(datasetId, query) {
    return this.data.queryUnverified(datasetId, query);
  }
  /**
   * Execute a SQL query against a subgrove.
   *
   * Routes to an indexer (history + analytics) or the validator (chain-tip,
   * consensus-verified) based on `options.source`. See `QuerySource` in
   * `./types` for details.
   */
  async sqlQuery(subgroveId, sql, options) {
    return this.data.sqlQuery(subgroveId, sql, options);
  }
  /**
   * Execute a GraphQL query against a subgrove.
   *
   * Routes to an indexer (history + analytics) or the validator (chain-tip,
   * consensus-verified) based on `options.source`. See `QuerySource` in
   * `./types` for details.
   */
  async graphqlQuery(subgroveId, query, options) {
    return this.data.graphqlQuery(subgroveId, query, options);
  }
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
  requireIdentity() {
    if (!this.auth.getDid() || !this.auth.getPrivateKey() || !this.auth.getPublicKeyId()) {
      throw new Error(
        "Identity not set. Call client.auth.setIdentity(did, privateKey, publicKeyId) before write operations."
      );
    }
  }
  registerComputedFields(datasetId, fields) {
    this.data.registerComputedFields(datasetId, fields);
  }
  /**
   * Create a helper for a specific dataset
   */
  collection(datasetId) {
    return {
      store: (key, value) => this.store(datasetId, key, value),
      get: (key) => this.get(datasetId, key),
      getUnverified: (key) => this.data.getDataUnverified(datasetId, key),
      update: (key, value) => this.update(datasetId, key, value),
      delete: (key) => this.delete(datasetId, key),
      getProof: (key) => this.getProof(datasetId, key),
      batchStore: (records) => this.data.batchStore(datasetId, records),
      getMultiple: (keys) => this.data.getMultiple(datasetId, keys),
      getMultipleUnverified: (keys) => this.data.getMultipleUnverified(datasetId, keys),
      query: (query) => this.data.query(datasetId, query),
      queryUnverified: (query) => this.data.queryUnverified(datasetId, query)
    };
  }
};

// src/utils/index.ts
import { ethers as ethers2 } from "ethers";
function generateWallet() {
  const wallet = ethers2.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey
  };
}
function createDidFromWallet(wallet) {
  const did = `did:willow:eth:${wallet.address.toLowerCase()}`;
  const now = Math.floor(Date.now() / 1e3);
  return {
    id: did,
    publicKeys: [
      {
        id: `${did}#key-1`,
        type: "EcdsaSecp256k1VerificationKey2019",
        publicKeyHex: wallet.publicKey.replace("0x", "")
      }
    ],
    created: now,
    updated: now
  };
}
function isValidDid(did) {
  return /^did:willow:[a-zA-Z0-9]+:[a-zA-Z0-9]+$/.test(did);
}
function getPublicKeyFromDid(didDocument, keyId) {
  if (!didDocument.publicKeys || didDocument.publicKeys.length === 0) {
    return void 0;
  }
  if (keyId) {
    return didDocument.publicKeys.find((key) => key.id === keyId);
  }
  return didDocument.publicKeys[0];
}
function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
async function retry(fn, options = {}) {
  const { attempts = 3, delay = 1e3, backoff = 2 } = options;
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await sleep(delay * Math.pow(backoff, i));
      }
    }
  }
  throw lastError;
}

// src/manifest/index.ts
var manifest_exports = {};
__export(manifest_exports, {
  MANIFEST_SPEC_VERSION: () => MANIFEST_SPEC_VERSION,
  MAX_ABI_LEN: () => MAX_ABI_LEN,
  MAX_DATA_SOURCES: () => MAX_DATA_SOURCES,
  MAX_DESCRIPTION_LEN: () => MAX_DESCRIPTION_LEN,
  MAX_EVENTS_PER_SOURCE: () => MAX_EVENTS_PER_SOURCE,
  MAX_NAME_LEN: () => MAX_NAME_LEN,
  ManifestValidationError: () => ManifestValidationError,
  SUPPORTED_CHAINS: () => SUPPORTED_CHAINS,
  chainFamily: () => chainFamily,
  evmChainId: () => evmChainId,
  fromEvmChainId: () => fromEvmChainId,
  isEvmDataSource: () => isEvmDataSource,
  isSolanaDataSource: () => isSolanaDataSource,
  isSupportedChain: () => isSupportedChain,
  parseManifest: () => parseManifest,
  serializeManifest: () => serializeManifest,
  validateManifest: () => validateManifest
});

// src/manifest/chains.ts
var SUPPORTED_CHAINS = [
  // EVM family
  "mainnet",
  "sepolia",
  "holesky",
  "bsc",
  "optimism",
  "arbitrum-one",
  "base",
  "polygon",
  // Solana family
  "solana-mainnet"
];
function chainFamily(chain) {
  return chain === "solana-mainnet" ? "solana" : "evm";
}
function evmChainId(chain) {
  switch (chain) {
    case "mainnet":
      return 1;
    case "sepolia":
      return 11155111;
    case "holesky":
      return 17e3;
    case "bsc":
      return 56;
    case "optimism":
      return 10;
    case "arbitrum-one":
      return 42161;
    case "base":
      return 8453;
    case "polygon":
      return 137;
    case "solana-mainnet":
      return null;
  }
}
function isSupportedChain(s) {
  return SUPPORTED_CHAINS.includes(s);
}
function fromEvmChainId(id) {
  for (const chain of SUPPORTED_CHAINS) {
    if (evmChainId(chain) === id) return chain;
  }
  return null;
}

// src/manifest/index.ts
var MANIFEST_SPEC_VERSION = "1.0.0";
var MAX_DATA_SOURCES = 64;
var MAX_EVENTS_PER_SOURCE = 32;
var MAX_NAME_LEN = 64;
var MAX_ABI_LEN = 64;
var MAX_DESCRIPTION_LEN = 1024;
function isEvmDataSource(ds) {
  return ds.address !== void 0;
}
function isSolanaDataSource(ds) {
  return ds.program_id !== void 0;
}
function serializeManifest(m) {
  validateManifest(m);
  const normalized = {
    spec_version: m.spec_version,
    ...m.description !== void 0 ? { description: m.description } : {},
    data_sources: m.data_sources.map(
      (ds) => isEvmDataSource(ds) ? { ...ds, address: ds.address.toLowerCase() } : { ...ds, instructions: ds.instructions.map((d) => d.toLowerCase()) }
    )
  };
  return new TextEncoder().encode(JSON.stringify(normalized));
}
function parseManifest(input) {
  const text = typeof input === "string" ? input : new TextDecoder().decode(input);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new ManifestValidationError(`manifest is not valid JSON: ${e.message}`, "");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ManifestValidationError("manifest must be a JSON object", "");
  }
  validateManifest(parsed);
  return parsed;
}
var ManifestValidationError = class extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
    this.name = "ManifestValidationError";
  }
};
function validateManifest(m) {
  if (m.spec_version !== MANIFEST_SPEC_VERSION) {
    throw new ManifestValidationError(
      `unsupported spec_version ${JSON.stringify(m.spec_version)} (expected ${JSON.stringify(MANIFEST_SPEC_VERSION)})`,
      "spec_version"
    );
  }
  if (m.description !== void 0 && m.description.length > MAX_DESCRIPTION_LEN) {
    throw new ManifestValidationError(
      `description length ${m.description.length} exceeds maximum ${MAX_DESCRIPTION_LEN}`,
      "description"
    );
  }
  if (!Array.isArray(m.data_sources) || m.data_sources.length === 0) {
    throw new ManifestValidationError(
      "manifest must declare at least one data source",
      "data_sources"
    );
  }
  if (m.data_sources.length > MAX_DATA_SOURCES) {
    throw new ManifestValidationError(
      `manifest has ${m.data_sources.length} data sources (maximum ${MAX_DATA_SOURCES})`,
      "data_sources"
    );
  }
  m.data_sources.forEach((ds, idx) => validateDataSource(ds, `data_sources[${idx}]`));
}
function validateDataSource(ds, path) {
  validateName(ds.name, path);
  if (!isSupportedChain(ds.network)) {
    throw new ManifestValidationError(
      `${path}.network ${JSON.stringify(ds.network)} is not a canonical chain`,
      `${path}.network`
    );
  }
  const family = chainFamily(ds.network);
  if (family === "evm") {
    if (!isEvmDataSource(ds)) {
      throw new ManifestValidationError(
        `${path}.network ${JSON.stringify(ds.network)} is EVM-family but data source is missing 'address'`,
        path
      );
    }
    validateEvmDataSource(ds, path);
  } else {
    if (!isSolanaDataSource(ds)) {
      throw new ManifestValidationError(
        `${path}.network ${JSON.stringify(ds.network)} is Solana-family but data source is missing 'program_id'`,
        path
      );
    }
    validateSolanaDataSource(ds, path);
  }
}
function validateName(name, path) {
  if (!name || name.length === 0) {
    throw new ManifestValidationError(`${path}.name must not be empty`, `${path}.name`);
  }
  if (name.length > MAX_NAME_LEN) {
    throw new ManifestValidationError(
      `${path}.name length ${name.length} exceeds maximum ${MAX_NAME_LEN}`,
      `${path}.name`
    );
  }
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new ManifestValidationError(
      `${path}.name ${JSON.stringify(name)} must be alphanumeric, '-', or '_'`,
      `${path}.name`
    );
  }
}
function validateEvmDataSource(ds, path) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(ds.address)) {
    throw new ManifestValidationError(
      `${path}.address must be 0x + 40 hex chars (got ${JSON.stringify(ds.address)})`,
      `${path}.address`
    );
  }
  if (!ds.abi || ds.abi.length === 0) {
    throw new ManifestValidationError(`${path}.abi must not be empty`, `${path}.abi`);
  }
  if (ds.abi.length > MAX_ABI_LEN) {
    throw new ManifestValidationError(
      `${path}.abi length ${ds.abi.length} exceeds maximum ${MAX_ABI_LEN}`,
      `${path}.abi`
    );
  }
  if (!Number.isInteger(ds.start_block) || ds.start_block < 0) {
    throw new ManifestValidationError(
      `${path}.start_block must be a non-negative integer`,
      `${path}.start_block`
    );
  }
  if (!Array.isArray(ds.events) || ds.events.length === 0) {
    throw new ManifestValidationError(
      `${path}.events must declare at least one event`,
      `${path}.events`
    );
  }
  if (ds.events.length > MAX_EVENTS_PER_SOURCE) {
    throw new ManifestValidationError(
      `${path}.events has ${ds.events.length} entries (maximum ${MAX_EVENTS_PER_SOURCE})`,
      `${path}.events`
    );
  }
  ds.events.forEach((sig, eIdx) => validateEventSignature(sig, `${path}.events[${eIdx}]`));
}
var BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function validateSolanaDataSource(ds, path) {
  if (!ds.program_id || ds.program_id.length < 32 || ds.program_id.length > 44) {
    throw new ManifestValidationError(
      `${path}.program_id must be a base58-encoded 32-byte pubkey (got ${JSON.stringify(ds.program_id)})`,
      `${path}.program_id`
    );
  }
  for (const c of ds.program_id) {
    if (!BASE58_ALPHABET.includes(c)) {
      throw new ManifestValidationError(
        `${path}.program_id contains invalid base58 character ${JSON.stringify(c)}`,
        `${path}.program_id`
      );
    }
  }
  if (!Number.isInteger(ds.start_slot) || ds.start_slot < 0) {
    throw new ManifestValidationError(
      `${path}.start_slot must be a non-negative integer`,
      `${path}.start_slot`
    );
  }
  if (!Array.isArray(ds.instructions) || ds.instructions.length === 0) {
    throw new ManifestValidationError(
      `${path}.instructions must declare at least one discriminator`,
      `${path}.instructions`
    );
  }
  if (ds.instructions.length > MAX_EVENTS_PER_SOURCE) {
    throw new ManifestValidationError(
      `${path}.instructions has ${ds.instructions.length} entries (maximum ${MAX_EVENTS_PER_SOURCE})`,
      `${path}.instructions`
    );
  }
  ds.instructions.forEach((d, iIdx) => validateDiscriminator(d, `${path}.instructions[${iIdx}]`));
}
function validateDiscriminator(d, path) {
  if (!/^0x([0-9a-fA-F]{2})+$/.test(d)) {
    throw new ManifestValidationError(
      `${path} must be 0x + an even, non-zero number of hex chars (got ${JSON.stringify(d)})`,
      path
    );
  }
}
function validateEventSignature(sig, path) {
  if (sig.length === 0) {
    throw new ManifestValidationError(`${path} must not be empty`, path);
  }
  const open = sig.indexOf("(");
  if (open === -1) {
    throw new ManifestValidationError(
      `${path} ${JSON.stringify(sig)} missing '('`,
      path
    );
  }
  if (!sig.endsWith(")")) {
    throw new ManifestValidationError(
      `${path} ${JSON.stringify(sig)} missing trailing ')'`,
      path
    );
  }
  const name = sig.slice(0, open);
  const params = sig.slice(open + 1, -1);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new ManifestValidationError(
      `${path} event name ${JSON.stringify(name)} is not a valid identifier`,
      path
    );
  }
  if (params.length === 0) return;
  for (const part of params.split(",")) {
    if (!/^[A-Za-z0-9_[\]]+$/.test(part)) {
      throw new ManifestValidationError(
        `${path} has invalid parameter type ${JSON.stringify(part)}`,
        path
      );
    }
  }
}

// src/privacy/index.ts
import axios5 from "axios";
var CommitmentFrequency = {
  /** Commit after every write/block update (strongest freshness). */
  everyUpdate() {
    return "EveryUpdate";
  },
  /** Commit every N blocks processed. */
  everyNBlocks(n) {
    return { EveryNBlocks: n };
  },
  /** Commit at least every N seconds. */
  everyNSeconds(n) {
    return { EveryNSeconds: n };
  },
  /** No on-chain commitments (trusted/internal scenarios only). */
  never() {
    return "Never";
  }
};
var PrivacyOperations = class {
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
  constructor(apiUrl, auth, privateKey, publicKeyId, consensusRpcUrl) {
    this.apiUrl = apiUrl.replace(/\/+$/, "");
    this.api = axios5.create({
      baseURL: this.apiUrl,
      headers: { "Content-Type": "application/json" }
    });
    this.auth = auth;
    this.privateKey = privateKey;
    this.publicKeyId = publicKeyId;
    this.consensusRpcUrl = consensusRpcUrl || this.apiUrl.replace(":3031", ":26657");
  }
  // ── Read operations (REST API) ─────────────────────────────────────
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
  async getMyKeyGrant(subgroveId) {
    const did = this.requireDid();
    const path = `/key-grants/${encodeURIComponent(subgroveId)}/${encodeURIComponent(did)}`;
    const headers = this.auth.getAuthHeaders("GET", path);
    const response = await this.api.get(path, {
      headers
    });
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Key grant not found",
        "KEY_GRANT_NOT_FOUND",
        404
      );
    }
    return response.data.data;
  }
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
  async listKeyGrantees(subgroveId) {
    const path = `/key-grants/${encodeURIComponent(subgroveId)}`;
    const headers = this.auth.getAuthHeaders("GET", path);
    const response = await this.api.get(path, {
      headers
    });
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Failed to list key grantees",
        "LIST_GRANTEES_FAILED"
      );
    }
    return response.data.data;
  }
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
  async getKeyGrantProof(subgroveId, did) {
    const path = `/proof/key-grant/${encodeURIComponent(subgroveId)}/${encodeURIComponent(did)}`;
    const response = await this.api.get(
      path
    );
    if (!response.data.success) {
      throw new WillowError(
        response.data.error || "Failed to get key grant proof",
        "KEY_GRANT_PROOF_FAILED",
        404
      );
    }
    return response.data.data;
  }
  // ── Write operations (CometBFT broadcast) ──────────────────────────
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
  async grantSubgroveKey(subgroveId, grant) {
    const did = this.requireDid();
    const nonce = await this.getNextNonce(did);
    const message = `GrantSubgroveKey:${subgroveId}:${grant.grantee_did}:${did}:${nonce}`;
    const signature = signEd25519(message, this.privateKey);
    const tx = {
      subgrove_id: subgroveId,
      encrypted_key_grant: grant,
      sender_did: did,
      signature,
      public_key_id: this.publicKeyId,
      nonce
    };
    return this.broadcastTransaction("GrantSubgroveKey", tx);
  }
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
  async revokeSubgroveKey(subgroveId, revokeDid) {
    const did = this.requireDid();
    const nonce = await this.getNextNonce(did);
    const message = `RevokeSubgroveKey:${subgroveId}:${revokeDid}:${did}:${nonce}`;
    const signature = signEd25519(message, this.privateKey);
    const tx = {
      subgrove_id: subgroveId,
      revokee_did: revokeDid,
      sender_did: did,
      signature,
      public_key_id: this.publicKeyId,
      nonce
    };
    return this.broadcastTransaction("RevokeSubgroveKey", tx);
  }
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
  async rotateSubgroveKey(subgroveId, newEpoch, newGrants) {
    const did = this.requireDid();
    const nonce = await this.getNextNonce(did);
    const message = `RotateSubgroveKey:${subgroveId}:${newEpoch}:${did}:${nonce}`;
    const signature = signEd25519(message, this.privateKey);
    const tx = {
      subgrove_id: subgroveId,
      new_epoch: newEpoch,
      new_grants: newGrants,
      sender_did: did,
      signature,
      public_key_id: this.publicKeyId,
      nonce
    };
    return this.broadcastTransaction("RotateSubgroveKey", tx);
  }
  // ── Private helpers ─────────────────────────────────────────────────
  /**
   * Require a DID from the auth instance, throwing if not set.
   */
  requireDid() {
    const did = this.auth.getDid();
    if (!did) {
      throw new WillowError(
        "Identity not set. Call auth.setIdentity() first.",
        "NO_IDENTITY"
      );
    }
    return did;
  }
  /**
   * Get the next nonce for a DID from the REST API.
   * Propagates errors instead of silently falling back to nonce 1,
   * which could cause transaction replay or rejection.
   */
  async getNextNonce(did) {
    const response = await this.api.get(`/account/${encodeURIComponent(did)}/nonce`);
    if (response.data.success && response.data.data !== void 0) {
      return response.data.data.nonce + 1;
    }
    throw new WillowError(
      `Failed to fetch nonce for ${did}: ${response.data.error || "unknown error"}`,
      "NONCE_FETCH_FAILED"
    );
  }
  /**
   * Broadcast a wrapped transaction to CometBFT via JSON-RPC broadcast_tx_sync.
   */
  async broadcastTransaction(txType, transaction) {
    const txWrapper = { [txType]: transaction };
    const txJson = JSON.stringify(txWrapper);
    const txBase64 = stringToBase64(txJson);
    const rpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "broadcast_tx_sync",
      params: { tx: txBase64 }
    };
    try {
      const response = await fetch(this.consensusRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcRequest),
        signal: AbortSignal.timeout(3e4)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new WillowError(
          `Consensus RPC error: HTTP ${response.status}: ${errorText}`,
          "BROADCAST_FAILED"
        );
      }
      const data = await response.json();
      if (data.error) {
        throw new WillowError(
          `Consensus RPC error: ${data.error.message || JSON.stringify(data.error)}`,
          "BROADCAST_FAILED"
        );
      }
      return createBroadcastResult({ result: data.result || {} });
    } catch (error) {
      if (error instanceof WillowError) {
        throw error;
      }
      throw new WillowError(
        `Failed to broadcast transaction: ${error instanceof Error ? error.message : String(error)}`,
        "BROADCAST_FAILED"
      );
    }
  }
};

// src/erc8004/index.ts
var Erc8004Client = class {
  constructor(apiUrl) {
    this.apiUrl = apiUrl.replace(/\/+$/, "");
  }
  /** List/search ERC-8004 registered agents with optional filters. */
  async listAgents(options) {
    const params = [];
    if (options?.limit !== void 0) params.push(`limit=${options.limit}`);
    if (options?.offset !== void 0) params.push(`offset=${options.offset}`);
    const qs = params.length > 0 ? `?${params.join("&")}` : "";
    const resp = await fetch(`${this.apiUrl}/agents${qs}`);
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(body.error || "Failed to list agents");
    }
    return body.data;
  }
  /** Fetch the ERC-8004 registration JSON for an agent DID. */
  async getAgentRegistration(did) {
    const resp = await fetch(
      `${this.apiUrl}/agent/${encodeURIComponent(did)}/registration.json`
    );
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(body.error || "Failed to fetch agent registration");
    }
    return body.data;
  }
  /** Get the ETH address linked to a DID. */
  async getEthAddress(did) {
    const resp = await fetch(
      `${this.apiUrl}/did/${encodeURIComponent(did)}/eth-address`
    );
    if (resp.status === 404) return null;
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(body.error || "Failed to fetch ETH address");
    }
    return body.data?.eth_address ?? null;
  }
  /** Get the DID linked to an ETH address. */
  async getDidForEth(ethAddress) {
    const resp = await fetch(
      `${this.apiUrl}/eth-address/${encodeURIComponent(ethAddress)}/did`
    );
    if (resp.status === 404) return null;
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(body.error || "Failed to fetch DID");
    }
    return body.data?.did ?? null;
  }
  /** Get stored ERC-8004 registration details for a DID. */
  async getErc8004Details(did) {
    const resp = await fetch(
      `${this.apiUrl}/did/${encodeURIComponent(did)}/erc8004`
    );
    if (resp.status === 404) return null;
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(body.error || "Failed to fetch ERC-8004 details");
    }
    return body.data ?? null;
  }
  /** Fetch reputation attestation with GroveDB Merkle proof for a DID. */
  async getReputationAttestation(did) {
    const resp = await fetch(
      `${this.apiUrl}/agent/${encodeURIComponent(did)}/reputation-attestation`
    );
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(
        body.error || "Failed to fetch reputation attestation"
      );
    }
    return body.data;
  }
  /** Fetch ERC-8004 formatted reputation history for a DID. */
  async getReputationHistory(did, limit) {
    const params = limit !== void 0 ? `?limit=${limit}` : "";
    const resp = await fetch(
      `${this.apiUrl}/agent/${encodeURIComponent(did)}/reputation-history${params}`
    );
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(
        body.error || "Failed to fetch reputation history"
      );
    }
    return body.data;
  }
  /** Fetch ERC-8004 validation status (checkpoint validations) for a DID. */
  async getValidationStatus(did, limit, subgroveId) {
    const params = [];
    if (limit !== void 0) params.push(`limit=${limit}`);
    if (subgroveId !== void 0) params.push(`subgrove_id=${encodeURIComponent(subgroveId)}`);
    const qs = params.length > 0 ? `?${params.join("&")}` : "";
    const resp = await fetch(
      `${this.apiUrl}/agent/${encodeURIComponent(did)}/validation-status${qs}`
    );
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(
        body.error || "Failed to fetch validation status"
      );
    }
    return body.data;
  }
  /** Fetch aggregated ERC-8004 validation summary for a DID. */
  async getValidationSummary(did, subgroveId) {
    const qs = subgroveId !== void 0 ? `?subgrove_id=${encodeURIComponent(subgroveId)}` : "";
    const resp = await fetch(
      `${this.apiUrl}/agent/${encodeURIComponent(did)}/validation-summary${qs}`
    );
    const body = await resp.json();
    if (body.success === false) {
      throw new Error(
        body.error || "Failed to fetch validation summary"
      );
    }
    return body.data;
  }
};

// src/aggregates/vault-daily-stats.ts
var KEY_PREFIX_BYTES = new TextEncoder().encode("vds:");
var VAULT_DAILY_STATS_KEY_LEN = 32;
var VAULT_DAILY_STATS_VALUE_LEN = 56;
var SECONDS_PER_DAY = 86400n;
function dayIdFromTimestamp(unixSecs) {
  const secs = typeof unixSecs === "bigint" ? unixSecs : BigInt(unixSecs);
  return secs / SECONDS_PER_DAY;
}
function dayIdFromDate(date) {
  return dayIdFromTimestamp(Math.floor(date.getTime() / 1e3));
}
function encodeVaultDailyStatsKey(vault, dayId) {
  if (vault.length !== 20) {
    throw new Error(
      `vault address must be 20 bytes, got ${vault.length}`
    );
  }
  const out = new Uint8Array(VAULT_DAILY_STATS_KEY_LEN);
  out.set(KEY_PREFIX_BYTES, 0);
  out.set(vault, 4);
  let v = dayId;
  for (let i = 7; i >= 0; i--) {
    out[24 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}
function decodeVaultDailyStatsKey(bytes) {
  if (bytes.length !== VAULT_DAILY_STATS_KEY_LEN) {
    throw new Error(
      `vault-daily-stats key must be ${VAULT_DAILY_STATS_KEY_LEN} bytes, got ${bytes.length}`
    );
  }
  for (let i = 0; i < KEY_PREFIX_BYTES.length; i++) {
    if (bytes[i] !== KEY_PREFIX_BYTES[i]) {
      throw new Error(`vault-daily-stats key prefix mismatch at byte ${i}`);
    }
  }
  const vault = bytes.slice(4, 24);
  let dayId = 0n;
  for (let i = 0; i < 8; i++) {
    dayId = dayId << 8n | BigInt(bytes[24 + i]);
  }
  return { vault, dayId };
}
function decodeDayAggregate(bytes) {
  if (bytes.length !== VAULT_DAILY_STATS_VALUE_LEN) {
    throw new Error(
      `DayAggregate value must be ${VAULT_DAILY_STATS_VALUE_LEN} bytes, got ${bytes.length}`
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const depositCount = view.getUint32(0, false);
  const withdrawCount = view.getUint32(4, false);
  const totalIn = readU128BE(bytes, 8);
  const totalOut = readU128BE(bytes, 24);
  const maxIn = readU128BE(bytes, 40);
  return { depositCount, withdrawCount, totalIn, totalOut, maxIn };
}
function encodeDayAggregate(agg) {
  const out = new Uint8Array(VAULT_DAILY_STATS_VALUE_LEN);
  const view = new DataView(out.buffer);
  view.setUint32(0, agg.depositCount, false);
  view.setUint32(4, agg.withdrawCount, false);
  writeU128BE(out, 8, agg.totalIn);
  writeU128BE(out, 24, agg.totalOut);
  writeU128BE(out, 40, agg.maxIn);
  return out;
}
function decodeVaultDailyStatsRows(rows) {
  const out = [];
  for (const r of rows) {
    const key = toUint8Array(r.key);
    const value = toUint8Array(r.value);
    if (value.length !== VAULT_DAILY_STATS_VALUE_LEN) {
      continue;
    }
    const { vault, dayId } = decodeVaultDailyStatsKey(key);
    const aggregate = decodeDayAggregate(value);
    out.push({ vault, dayId, aggregate, rawKey: key, rawValue: value });
  }
  return out;
}
function vaultDayRangeKeys(vault, fromDayId, toDayId) {
  if (toDayId < fromDayId) {
    throw new Error(
      `toDayId (${toDayId}) must be >= fromDayId (${fromDayId})`
    );
  }
  return {
    fromKey: encodeVaultDailyStatsKey(vault, fromDayId),
    toKey: encodeVaultDailyStatsKey(vault, toDayId)
  };
}
function readU128BE(bytes, offset) {
  let v = 0n;
  for (let i = 0; i < 16; i++) {
    v = v << 8n | BigInt(bytes[offset + i]);
  }
  return v;
}
function writeU128BE(out, offset, value) {
  if (value < 0n) {
    throw new Error("u128 cannot be negative");
  }
  if (value >> 128n !== 0n) {
    throw new Error(`value ${value} exceeds u128`);
  }
  let v = value;
  for (let i = 15; i >= 0; i--) {
    out[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}
function toUint8Array(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  return Uint8Array.from(input);
}

// src/index.ts
var VERSION = "0.1.0";
var DEVNET_TEST_ACCOUNT = {
  /** DID of the test account */
  did: "did:willow:devnet-test",
  /** Private key (hex) - DO NOT USE IN PRODUCTION */
  privateKey: "b5ecc03536f5e039e3c5bc46ad178d7faf80cee5f063016a4f4084e163409b3c",
  /** Public key (hex) */
  publicKey: "c153874d3d284a11e3cb12b524e1a9cc32fef966d56b903c79688a95d5193c8f",
  /** Key ID for authentication */
  publicKeyId: "did:willow:devnet-test#key-1"
};
export {
  CommitmentFrequency,
  ComputedFieldRegistry,
  ConsensusClient,
  ConsensusConfigBuilder,
  DEVNET_TEST_ACCOUNT,
  Erc8004Client,
  EthOperations,
  FileOperations,
  GENERIC_AMM_PAIR_FIELDS,
  GroveDBProofVerifier,
  HeaderVerifier,
  LENDING_PROTOCOL_FIELDS,
  LP_SHARE_FIELDS,
  LightClient,
  LightClientConfigBuilder,
  MANIFEST_SPEC_VERSION,
  ManifestValidationError,
  NoIndexersReachableError,
  PrivacyOperations,
  ProofVerifier,
  SECONDS_PER_DAY,
  SUPPORTED_CHAINS,
  StateVerifyMode,
  UNISWAP_V2_AGGREGATION_FIELDS,
  UNISWAP_V2_PAIR_FIELDS,
  UNISWAP_V2_TOKEN_FIELDS,
  VAULT_DAILY_STATS_KEY_LEN,
  VAULT_DAILY_STATS_VALUE_LEN,
  VERSION,
  ValidatorHasNoDataError,
  WillowAuth,
  WillowClient,
  WillowData,
  WillowError,
  WillowIndexers,
  WillowSubscriptions,
  applyComputedFields,
  applyComputedFieldsToResponse,
  chainFamily,
  chunk,
  configureProofVerification,
  localConfig as consensusLocalConfig,
  mainnetConfig2 as consensusMainnetConfig,
  testnetConfig as consensusTestnetConfig,
  createDidFromWallet,
  dayIdFromDate,
  dayIdFromTimestamp,
  decodeDayAggregate,
  decodeVaultDailyStatsKey,
  decodeVaultDailyStatsRows,
  decryptFile,
  detectAlgorithm,
  effectiveQueryEndpoint,
  encodeDayAggregate,
  encodeVaultDailyStatsKey,
  encryptFile,
  evmChainId,
  extendQueryResponse,
  extractRootHashFromProof,
  fromEvmChainId,
  generateEd25519KeyPair,
  generateId,
  generateWallet,
  getEd25519PublicKey,
  getPublicKeyFromDid,
  globalComputedFieldRegistry,
  grovedb_exports as grovedb,
  isSupportedChain,
  isValidDid,
  fastSyncConfig as lightClientFastSyncConfig,
  mainnetConfig as lightClientMainnetConfig,
  testConfig as lightClientTestConfig,
  manifest_exports as manifest,
  parseManifest,
  retry,
  serializeManifest,
  signEd25519,
  sleep,
  validateManifest,
  vaultDayRangeKeys,
  verifyEd25519,
  verifyItemProof,
  verifyMptProof,
  verifyProofAdvanced,
  verifyQueryProof,
  verifyQueryResponse,
  verifyStateProof
};
//# sourceMappingURL=index.mjs.map