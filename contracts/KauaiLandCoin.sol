// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract KauaiLandCoin is ERC20 {
    uint256 public constant FEE_BPS = 200; // 2%

    address public owner;
    address public donationWallet;
    address public payrollWallet;
    address public employeeVault;

    uint256 public donationBps;
    uint256 public payrollBps;
    uint256 public vaultBps;

    bool public feesEnabled;

    mapping(address => bool) public isFeeExempt;
    mapping(address => bool) public isAmmPair;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeWalletsUpdated(address donationWallet, address payrollWallet, address employeeVault);
    event FeeSharesUpdated(uint256 donationBps, uint256 payrollBps, uint256 vaultBps);
    event FeesEnabledUpdated(bool enabled);
    event AmmPairUpdated(address indexed pair, bool isPair);
    event FeeExemptUpdated(address indexed account, bool isExempt);

    modifier onlyOwner() {
        require(msg.sender == owner, "KLC: caller is not the owner");
        _;
    }

    constructor(uint256 initialSupply) ERC20("Kauai Land Coin", "KLC") {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        donationBps = 100;
        payrollBps = 50;
        vaultBps = 50;

        isFeeExempt[msg.sender] = true;
        isFeeExempt[address(this)] = true;

        _mint(msg.sender, initialSupply);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "KLC: new owner is zero");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeeWallets(
        address donationWallet_,
        address payrollWallet_,
        address employeeVault_
    ) external onlyOwner {
        require(donationWallet_ != address(0), "KLC: donation wallet is zero");
        require(payrollWallet_ != address(0), "KLC: payroll wallet is zero");
        require(employeeVault_ != address(0), "KLC: vault is zero");
        donationWallet = donationWallet_;
        payrollWallet = payrollWallet_;
        employeeVault = employeeVault_;
        emit FeeWalletsUpdated(donationWallet_, payrollWallet_, employeeVault_);
    }

    function setFeeShares(uint256 donationBps_, uint256 payrollBps_, uint256 vaultBps_)
        external
        onlyOwner
    {
        require(donationBps_ + payrollBps_ + vaultBps_ == FEE_BPS, "KLC: shares != fee");
        donationBps = donationBps_;
        payrollBps = payrollBps_;
        vaultBps = vaultBps_;
        emit FeeSharesUpdated(donationBps_, payrollBps_, vaultBps_);
    }

    function setFeesEnabled(bool enabled) external onlyOwner {
        if (enabled) {
            require(donationWallet != address(0), "KLC: donation wallet unset");
            require(payrollWallet != address(0), "KLC: payroll wallet unset");
            require(employeeVault != address(0), "KLC: vault unset");
            require(donationBps + payrollBps + vaultBps == FEE_BPS, "KLC: shares != fee");
        }
        feesEnabled = enabled;
        emit FeesEnabledUpdated(enabled);
    }

    function setAmmPair(address pair, bool isPair) external onlyOwner {
        require(pair != address(0), "KLC: pair is zero");
        isAmmPair[pair] = isPair;
        emit AmmPairUpdated(pair, isPair);
    }

    function setFeeExempt(address account, bool exempt) external onlyOwner {
        require(account != address(0), "KLC: account is zero");
        isFeeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        if (!feesEnabled || isFeeExempt[from] || isFeeExempt[to]) {
            super._transfer(from, to, amount);
            return;
        }

        bool isTrade = isAmmPair[from] || isAmmPair[to];
        if (!isTrade) {
            super._transfer(from, to, amount);
            return;
        }

        uint256 fee = (amount * FEE_BPS) / 10_000;
        if (fee == 0) {
            super._transfer(from, to, amount);
            return;
        }

        uint256 donationAmount = (amount * donationBps) / 10_000;
        uint256 payrollAmount = (amount * payrollBps) / 10_000;
        uint256 vaultAmount = fee - donationAmount - payrollAmount;
        uint256 remaining = amount - fee;

        super._transfer(from, donationWallet, donationAmount);
        super._transfer(from, payrollWallet, payrollAmount);
        if (vaultAmount > 0) {
            super._transfer(from, employeeVault, vaultAmount);
        }
        super._transfer(from, to, remaining);
    }
}
