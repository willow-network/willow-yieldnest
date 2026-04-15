// YieldNest subgrove IDs — must match partners/yieldnest/subgroves/*.json in the
// willow repo. Keep in sync.
export const SUBGROVES = {
  vaultsEth:     "yieldnest-vaults-eth",
  vaultsBnb:     "yieldnest-vaults-bnb",
  vaultsL2:      "yieldnest-vaults-l2",
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
  { symbol: "ynBNB",   name: "YieldNest BNB",        chainId: 56, address: "0x304B5845b9114182ECb4495Be4C91a273b74B509", subgrove: SUBGROVES.vaultsBnb },
  { symbol: "ynBNBx",  name: "ynBNB MAX",            chainId: 56, address: "0x32C830f5c34122C6afB8aE87ABA541B7900a2C5F", subgrove: SUBGROVES.vaultsBnb },
  { symbol: "ynBTCk",  name: "ynBTC Kernel",         chainId: 56, address: "0x78839cE14a8213779128Ee4da6D75E1326606A56", subgrove: SUBGROVES.vaultsBnb },
];
