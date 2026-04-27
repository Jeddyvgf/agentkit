// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

/**
 * Copyright (c) 2026 KleanKut Technologies.
 * Commercial usage requires written approval from KleanKut Technologies.
 *
 * EVM-only deployment target. Deploy once per EVM chain.
 */
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract KleanKutFeeHub is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_FEE_BPS = 1_000; // 10.00%
    string public constant LICENSEE = "KleanKut Technologies";

    enum Product {
        Subscription,
        EscrowRelease,
        RelayerService,
        Checkout,
        MevRebate,
        InvoiceSettlement
    }

    address public feeCollector;
    bool public configFrozen;
    mapping(Product => uint16) public feeBps;

    error ZeroAddress();
    error InvalidFee();
    error Frozen();
    error AmountZero();
    error NativeTransferFailed();
    error InvalidArrayLength();

    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FeeBpsUpdated(Product indexed product, uint16 oldFeeBps, uint16 newFeeBps);
    event ConfigFrozenForever();
    event PaymentProcessed(
        Product indexed product,
        address indexed token,
        address indexed payer,
        address recipient,
        uint256 grossAmount,
        uint256 feeAmount,
        bytes32 referenceId
    );
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);
    event NativeRecovered(address indexed to, uint256 amount);

    modifier onlyMutableConfig() {
        if (configFrozen) revert Frozen();
        _;
    }

    constructor(address initialOwner, address initialCollector) Ownable(initialOwner) {
        if (initialOwner == address(0) || initialCollector == address(0)) revert ZeroAddress();

        feeCollector = initialCollector;

        feeBps[Product.Subscription] = 50; // 0.50%
        feeBps[Product.EscrowRelease] = 100; // 1.00%
        feeBps[Product.RelayerService] = 75; // 0.75%
        feeBps[Product.Checkout] = 60; // 0.60%
        feeBps[Product.MevRebate] = 500; // 5.00%
        feeBps[Product.InvoiceSettlement] = 150; // 1.50%
    }

    function setFeeCollector(address newCollector) external onlyOwner onlyMutableConfig {
        if (newCollector == address(0)) revert ZeroAddress();
        emit FeeCollectorUpdated(feeCollector, newCollector);
        feeCollector = newCollector;
    }

    function setFeeBps(Product product, uint16 newFeeBps) external onlyOwner onlyMutableConfig {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFee();
        emit FeeBpsUpdated(product, feeBps[product], newFeeBps);
        feeBps[product] = newFeeBps;
    }

    function setFeeBpsBatch(Product[] calldata products, uint16[] calldata newFeeBps)
        external
        onlyOwner
        onlyMutableConfig
    {
        if (products.length == 0 || products.length != newFeeBps.length) revert InvalidArrayLength();

        for (uint256 i = 0; i < products.length; i++) {
            if (newFeeBps[i] > MAX_FEE_BPS) revert InvalidFee();
            emit FeeBpsUpdated(products[i], feeBps[products[i]], newFeeBps[i]);
            feeBps[products[i]] = newFeeBps[i];
        }
    }

    function freezeConfigForever() external onlyOwner onlyMutableConfig {
        configFrozen = true;
        emit ConfigFrozenForever();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function renounceOwnership() public view override onlyOwner {
        revert("RENOUNCE_DISABLED");
    }

    function quoteFee(Product product, uint256 grossAmount)
        external
        view
        returns (uint256 netAmount, uint256 feeAmount)
    {
        return _split(product, grossAmount);
    }

    function paySubscriptionERC20(
        IERC20 token,
        address recipient,
        uint256 grossAmount,
        bytes32 subscriptionId
    ) external whenNotPaused nonReentrant returns (uint256 netAmount, uint256 feeAmount) {
        return _payERC20(Product.Subscription, token, recipient, grossAmount, subscriptionId);
    }

    function releaseEscrowERC20(
        IERC20 token,
        address recipient,
        uint256 grossAmount,
        bytes32 escrowId
    ) external whenNotPaused nonReentrant returns (uint256 netAmount, uint256 feeAmount) {
        return _payERC20(Product.EscrowRelease, token, recipient, grossAmount, escrowId);
    }

    function payRelayerERC20(
        IERC20 token,
        address recipient,
        uint256 grossAmount,
        bytes32 jobId
    ) external whenNotPaused nonReentrant returns (uint256 netAmount, uint256 feeAmount) {
        return _payERC20(Product.RelayerService, token, recipient, grossAmount, jobId);
    }

    function checkoutERC20(
        IERC20 token,
        address merchant,
        uint256 grossAmount,
        bytes32 orderId
    ) external whenNotPaused nonReentrant returns (uint256 netAmount, uint256 feeAmount) {
        return _payERC20(Product.Checkout, token, merchant, grossAmount, orderId);
    }

    function settleMevRebateERC20(
        IERC20 token,
        address recipient,
        uint256 grossAmount,
        bytes32 routeId
    ) external whenNotPaused nonReentrant returns (uint256 netAmount, uint256 feeAmount) {
        return _payERC20(Product.MevRebate, token, recipient, grossAmount, routeId);
    }

    function settleInvoiceERC20(
        IERC20 token,
        address recipient,
        uint256 grossAmount,
        bytes32 invoiceId
    ) external whenNotPaused nonReentrant returns (uint256 netAmount, uint256 feeAmount) {
        return _payERC20(Product.InvoiceSettlement, token, recipient, grossAmount, invoiceId);
    }

    function checkoutNative(address payable merchant, bytes32 orderId)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 netAmount, uint256 feeAmount)
    {
        return _payNative(Product.Checkout, merchant, msg.value, orderId);
    }

    function recoverERC20(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        token.safeTransfer(to, amount);
        emit ERC20Recovered(address(token), to, amount);
    }

    function recoverNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
        emit NativeRecovered(to, amount);
    }

    function _payERC20(
        Product product,
        IERC20 token,
        address recipient,
        uint256 grossAmount,
        bytes32 referenceId
    ) internal returns (uint256 netAmount, uint256 feeAmount) {
        if (recipient == address(0)) revert ZeroAddress();
        if (grossAmount == 0) revert AmountZero();

        token.safeTransferFrom(msg.sender, address(this), grossAmount);
        (netAmount, feeAmount) = _split(product, grossAmount);

        if (feeAmount > 0) token.safeTransfer(feeCollector, feeAmount);
        token.safeTransfer(recipient, netAmount);

        emit PaymentProcessed(
            product,
            address(token),
            msg.sender,
            recipient,
            grossAmount,
            feeAmount,
            referenceId
        );
    }

    function _payNative(
        Product product,
        address payable recipient,
        uint256 grossAmount,
        bytes32 referenceId
    ) internal returns (uint256 netAmount, uint256 feeAmount) {
        if (recipient == address(0)) revert ZeroAddress();
        if (grossAmount == 0) revert AmountZero();

        (netAmount, feeAmount) = _split(product, grossAmount);

        if (feeAmount > 0) {
            (bool okFee,) = payable(feeCollector).call{value: feeAmount}("");
            if (!okFee) revert NativeTransferFailed();
        }

        (bool okRecipient,) = recipient.call{value: netAmount}("");
        if (!okRecipient) revert NativeTransferFailed();

        emit PaymentProcessed(
            product,
            address(0),
            msg.sender,
            recipient,
            grossAmount,
            feeAmount,
            referenceId
        );
    }

    function _split(Product product, uint256 grossAmount)
        internal
        view
        returns (uint256 netAmount, uint256 feeAmount)
    {
        feeAmount = (grossAmount * feeBps[product]) / BPS_DENOMINATOR;
        netAmount = grossAmount - feeAmount;
    }
}
