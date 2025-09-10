require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  defaultNetwork: "oasisTestnet",
  networks: {
    hardhat: {},
    oasisTestnet: {
      url: process.env.RPC_URL,
      chainId: 23295,
      accounts: [ process.env.PRIVATE_KEY ]
    }
  },

solidity: "0.8.28"
};

