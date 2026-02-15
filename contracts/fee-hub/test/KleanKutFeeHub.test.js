const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KleanKutFeeHub", function () {
  let owner;
  let collector;
  let payer;
  let recipient;
  let hub;
  let token;

  beforeEach(async function () {
    [owner, collector, payer, recipient] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USD", "mUSD");
    await token.waitForDeployment();

    const FeeHub = await ethers.getContractFactory("KleanKutFeeHub");
    hub = await FeeHub.deploy(owner.address, collector.address);
    await hub.waitForDeployment();

    await token.mint(payer.address, ethers.parseUnits("100000", 18));
  });

  it("splits subscription ERC20 payments to collector and recipient", async function () {
    const amount = ethers.parseUnits("1000", 18);
    const expectedFee = (amount * 50n) / 10_000n;
    const expectedNet = amount - expectedFee;

    await token.connect(payer).approve(await hub.getAddress(), amount);
    await hub
      .connect(payer)
      .paySubscriptionERC20(
        await token.getAddress(),
        recipient.address,
        amount,
        ethers.id("subscription-001"),
      );

    expect(await token.balanceOf(collector.address)).to.equal(expectedFee);
    expect(await token.balanceOf(recipient.address)).to.equal(expectedNet);
  });

  it("splits native checkout payment using checkout fee", async function () {
    const amount = ethers.parseEther("1");
    const expectedFee = (amount * 60n) / 10_000n;
    const expectedNet = amount - expectedFee;

    const collectorBefore = await ethers.provider.getBalance(collector.address);
    const recipientBefore = await ethers.provider.getBalance(recipient.address);

    await hub.connect(payer).checkoutNative(recipient.address, ethers.id("order-001"), {
      value: amount,
    });

    const collectorAfter = await ethers.provider.getBalance(collector.address);
    const recipientAfter = await ethers.provider.getBalance(recipient.address);

    expect(collectorAfter - collectorBefore).to.equal(expectedFee);
    expect(recipientAfter - recipientBefore).to.equal(expectedNet);
  });

  it("blocks configuration changes after freeze", async function () {
    await hub.freezeConfigForever();

    await expect(hub.setFeeCollector(recipient.address)).to.be.revertedWithCustomError(
      hub,
      "Frozen",
    );
    await expect(hub.setFeeBps(0, 25)).to.be.revertedWithCustomError(hub, "Frozen");
  });

  it("enforces max fee cap", async function () {
    await expect(hub.setFeeBps(0, 1001)).to.be.revertedWithCustomError(hub, "InvalidFee");
  });

  it("supports batch fee updates with guardrails", async function () {
    await expect(hub.setFeeBpsBatch([0, 1], [100])).to.be.revertedWithCustomError(
      hub,
      "InvalidArrayLength",
    );

    await hub.setFeeBpsBatch([0, 3], [75, 80]);
    expect(await hub.feeBps(0)).to.equal(75);
    expect(await hub.feeBps(3)).to.equal(80);
  });

  it("disables owner renounce for safety", async function () {
    await expect(hub.renounceOwnership()).to.be.revertedWith("RENOUNCE_DISABLED");
  });
});
