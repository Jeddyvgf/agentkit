// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title JeddyAndMandyCaSH
 * @notice Simple ERC-20 token with an initial mint to the deployer.
 * @dev Uses OpenZeppelin's ERC20 + Ownable. This repo's other example contracts
 *      use OZ v4-style imports, so we rely on Ownable's default constructor
 *      (owner = msg.sender).
 */
contract JeddyAndMandyCaSH is ERC20, Ownable {
    /**
     * @param initialSupply Initial token supply in the smallest unit (wei-style),
     *        e.g. 1_000_000 * 10**18 for 1,000,000 tokens with 18 decimals.
     */
    constructor(uint256 initialSupply) ERC20("JeddyAndMandyCa$H", "JMCASH") {
        _mint(msg.sender, initialSupply);
    }
}

