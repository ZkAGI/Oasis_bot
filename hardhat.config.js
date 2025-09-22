require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

const { RPC_URL, PRIVATE_KEY } = process.env;

if (!RPC_URL) throw new Error("Missing RPC_URL in .env");
if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
  throw new Error("PRIVATE_KEY must be 0x-prefixed");
}

module.exports = {
  defaultNetwork: "oasisTestnet",
  networks: {
    hardhat: {},
    oasisTestnet: {
      url: RPC_URL,
      chainId: 23295,
      accounts: [PRIVATE_KEY],
    },
  },
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
};

