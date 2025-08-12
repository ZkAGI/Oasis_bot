const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with", deployer.address);

  const Agent = await ethers.getContractFactory("AgentRegistry");
  const agent = await Agent.deploy(deployer.address);
  await agent.deployed();
  console.log("AgentRegistry:", agent.address);

  const Store = await ethers.getContractFactory("StrategyStore");
  const store = await Store.deploy();
  await store.deployed();
  console.log("StrategyStore:", store.address);

  const Enc = await ethers.getContractFactory("EncryptedPortfolio");
  const enc = await Enc.deploy();
  await enc.deployed();
  console.log("EncryptedPortfolio:", enc.address);

  const Verif = await ethers.getContractFactory("StateVerifier");
  const verif = await Verif.deploy();
  await verif.deployed();
  console.log("StateVerifier:", verif.address);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

