// Subgrove IDs — must match the manifests in protocol/subgroves/ and the
// indexer's subgrove_filter.
export const SUBGROVES = {
  vaultsEth:     "yieldnest-vaults-eth",
  restakingEth:  "yieldnest-restaking-eth",
  liquidity:     "yieldnest-liquidity",
  governance:    "yieldnest-governance",
} as const;

export type VaultMeta = {
  symbol: string;
  name: string;
  chainId: number;
  address: string;
  subgrove: string;
};

export const VAULTS: VaultMeta[] = [
  { symbol: "ynETH",   name: "YieldNest ETH",        chainId: 1,  address: "0x09db87A538BD693E9d08544577d5cCfAA6373A48", subgrove: SUBGROVES.vaultsEth },
  { symbol: "ynLSDe",  name: "YieldNest LSD Basket", chainId: 1,  address: "0x35Ec69A77B79c255e5d47D5A3BdbEFEfE342630c", subgrove: SUBGROVES.vaultsEth },
  { symbol: "ynETHx",  name: "ynETH MAX",            chainId: 1,  address: "0x657d9ABA1DBb59e53f9F3eCAA878447dCfC96dCb", subgrove: SUBGROVES.vaultsEth },
  { symbol: "ynUSDx",  name: "ynUSD MAX",            chainId: 1,  address: "0x3DB228FE836D99Ccb25Ec4dfdC80ED6d2CDdCB4b", subgrove: SUBGROVES.vaultsEth },
  { symbol: "ynRWAx",  name: "ynRWA MAX",            chainId: 1,  address: "0x01Ba69727E2860b37bc1a2bd56999c1aFb4C15D8", subgrove: SUBGROVES.vaultsEth },
];
