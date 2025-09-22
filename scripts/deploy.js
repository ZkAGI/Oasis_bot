const { ethers } = require("hardhat");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.ADMIN || deployer.address;

  console.log("Network   :", (await deployer.provider.getNetwork()).chainId);
  console.log("Deployer  :", deployer.address);
  console.log("Admin     :", admin);

  // 1) AgentRegistry(admin)
  const Agent = await ethers.getContractFactory("AgentRegistry");
  const agent = await Agent.deploy(admin);
  await agent.deployed();
  console.log("AgentRegistry:", agent.address);

  // 2) StrategyStore(admin)
  const Store = await ethers.getContractFactory("StrategyStore");
  const store = await Store.deploy(admin);
  await store.deployed();
  console.log("StrategyStore:", store.address);

  // 3) EncryptedPortfolio(agentRegistry)
  const Enc = await ethers.getContractFactory("EncryptedPortfolio");
  const enc = await Enc.deploy(agent.address);
  await enc.deployed();
  console.log("EncryptedPortfolio:", enc.address);

  // Optional: keep StateVerifier ONLY if you use it elsewhere.
  // const Verif = await ethers.getContractFactory("StateVerifier");
  // const verif = await Verif.deploy();
  // await verif.deployed();
  // console.log("StateVerifier:", verif.address);

  // Save addresses for your bot
  const out = {
    chainId: (await deployer.provider.getNetwork()).chainId,
    deployer: deployer.address,
    admin,
    AgentRegistry: agent.address,
    StrategyStore: store.address,
    EncryptedPortfolio: enc.address,
    MANAGER_ROLE: await agent.MANAGER_ROLE(),
  };
  const outPath = path.join(__dirname, "..", "deployed.oasisTestnet.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

