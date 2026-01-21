// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KauaiLandToken (KLT) - Educational Smart Contract
 * @dev This contract demonstrates Ethereum concepts while honoring Native Hawaiian land rights
 * @notice This is an educational contract showcasing blockchain technology and Hawaiian sovereignty
 *
 * EDUCATIONAL PURPOSE:
 * - Demonstrates ERC-20 token standard
 * - Shows how smart contracts can encode cultural values
 * - Illustrates decentralized governance concepts
 * - Teaches about ownership, transfers, and access control
 *
 * CULTURAL SIGNIFICANCE:
 * - Honors Native Hawaiian relationship with 'aina (land)
 * - Incorporates concepts of collective stewardship
 * - Respects traditional Hawaiian governance (ali'i system)
 * - Promotes education about Hawaiian sovereignty
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract KauaiLandToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    // ==================== ROLES AND GOVERNANCE ====================
    bytes32 public constant ALII_ROLE = keccak256("ALII_ROLE");
    bytes32 public constant KAHU_ROLE = keccak256("KAHU_ROLE");
    bytes32 public constant EDUCATOR_ROLE = keccak256("EDUCATOR_ROLE");

    // ==================== STATE VARIABLES ====================
    struct LandParcel {
        string ahupuaa;
        uint256 area;
        string culturalSignificance;
        bool isProtected;
        address steward;
        uint256 stewardshipFee;
    }

    struct EducationalContent {
        string topic;
        string content;
        address educator;
        uint256 timestamp;
        bool isActive;
    }

    mapping(uint256 => LandParcel) public landParcels;
    mapping(address => uint256[]) public stewardedLands;
    mapping(uint256 => EducationalContent) public educationalContent;
    mapping(address => bool) public completedEducation;
    mapping(address => uint256) public culturalContributions;

    uint256 public totalLandParcels;
    uint256 public totalEducationalContent;
    uint256 public totalStewards;

    // ==================== EVENTS ====================
    event LandTokenized(uint256 indexed parcelId, string ahupuaa, address steward);
    event StewardshipTransferred(uint256 indexed parcelId, address from, address to);
    event EducationalContentAdded(uint256 indexed contentId, string topic, address educator);
    event CulturalContribution(address contributor, uint256 amount, string description);
    event EducationCompleted(address student, string achievement);

    // ==================== MODIFIERS ====================
    modifier onlyAlii() {
        require(hasRole(ALII_ROLE, msg.sender), "Must have Ali'i role");
        _;
    }

    modifier onlyKahu() {
        require(hasRole(KAHU_ROLE, msg.sender), "Must have Kahu role");
        _;
    }

    modifier onlyEducator() {
        require(hasRole(EDUCATOR_ROLE, msg.sender), "Must have Educator role");
        _;
    }

    modifier landExists(uint256 parcelId) {
        require(parcelId < totalLandParcels, "Land parcel does not exist");
        _;
    }

    modifier educationRequired() {
        require(completedEducation[msg.sender], "Must complete cultural education first");
        _;
    }

    // ==================== CONSTRUCTOR ====================
    constructor() ERC20("Kauai Land Token", "KLT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ALII_ROLE, msg.sender);
        _grantRole(KAHU_ROLE, msg.sender);
        _grantRole(EDUCATOR_ROLE, msg.sender);

        _mint(msg.sender, 1000000 * 10**decimals());

        _addInitialEducationalContent();
    }

    // ==================== EDUCATIONAL FUNCTIONS ====================
    function addEducationalContent(
        string memory topic,
        string memory content
    ) external onlyEducator whenNotPaused {
        uint256 contentId = totalEducationalContent;

        educationalContent[contentId] = EducationalContent({
            topic: topic,
            content: content,
            educator: msg.sender,
            timestamp: block.timestamp,
            isActive: true
        });

        totalEducationalContent++;
        emit EducationalContentAdded(contentId, topic, msg.sender);
    }

    function completeEducation() external whenNotPaused {
        require(!completedEducation[msg.sender], "Education already completed");

        completedEducation[msg.sender] = true;

        _mint(msg.sender, 100 * 10**decimals());

        emit EducationCompleted(msg.sender, "Cultural and Blockchain Education");
    }

    // ==================== LAND STEWARDSHIP ====================
    function tokenizeLand(
        string memory ahupuaa,
        uint256 area,
        string memory culturalSignificance,
        bool isProtected,
        address initialSteward
    ) external onlyAlii whenNotPaused {
        require(bytes(ahupuaa).length > 0, "Ahupua'a name required");
        require(area > 0, "Area must be greater than 0");
        require(initialSteward != address(0), "Invalid steward address");

        uint256 parcelId = totalLandParcels;

        landParcels[parcelId] = LandParcel({
            ahupuaa: ahupuaa,
            area: area,
            culturalSignificance: culturalSignificance,
            isProtected: isProtected,
            steward: initialSteward,
            stewardshipFee: area * 1 ether / 10000
        });

        stewardedLands[initialSteward].push(parcelId);
        totalLandParcels++;

        if (stewardedLands[initialSteward].length == 1) {
            totalStewards++;
        }

        emit LandTokenized(parcelId, ahupuaa, initialSteward);
    }

    function transferStewardship(
        uint256 parcelId,
        address newSteward
    ) external landExists(parcelId) educationRequired whenNotPaused nonReentrant {
        LandParcel storage parcel = landParcels[parcelId];

        require(parcel.steward == msg.sender, "Only current steward can transfer");
        require(!parcel.isProtected, "Protected land cannot be transferred");
        require(newSteward != address(0), "Invalid new steward address");
        require(completedEducation[newSteward], "New steward must complete education");

        require(balanceOf(msg.sender) >= parcel.stewardshipFee, "Insufficient tokens for stewardship fee");
        _burn(msg.sender, parcel.stewardshipFee);

        address oldSteward = parcel.steward;
        parcel.steward = newSteward;

        _removeLandFromSteward(oldSteward, parcelId);
        stewardedLands[newSteward].push(parcelId);

        if (stewardedLands[newSteward].length == 1) {
            totalStewards++;
        }

        emit StewardshipTransferred(parcelId, oldSteward, newSteward);
    }

    // ==================== CULTURAL CONTRIBUTIONS ====================
    function makeCulturalContribution(
        string memory description
    ) external payable whenNotPaused {
        require(msg.value > 0, "Contribution must be greater than 0");
        require(bytes(description).length > 0, "Description required");

        culturalContributions[msg.sender] += msg.value;

        uint256 tokensToMint = (msg.value * 1000 * 10**decimals()) / 1 ether;
        _mint(msg.sender, tokensToMint);

        emit CulturalContribution(msg.sender, msg.value, description);
    }

    function withdrawContributions(
        address payable recipient,
        uint256 amount,
        string memory purpose
    ) external onlyAlii whenNotPaused {
        require(address(this).balance >= amount, "Insufficient contract balance");
        require(bytes(purpose).length > 0, "Purpose required");

        recipient.transfer(amount);
    }

    // ==================== VIEW FUNCTIONS ====================
    function getLandParcel(uint256 parcelId) external view landExists(parcelId) returns (
        string memory ahupuaa,
        uint256 area,
        string memory culturalSignificance,
        bool isProtected,
        address steward,
        uint256 stewardshipFee
    ) {
        LandParcel memory parcel = landParcels[parcelId];
        return (
            parcel.ahupuaa,
            parcel.area,
            parcel.culturalSignificance,
            parcel.isProtected,
            parcel.steward,
            parcel.stewardshipFee
        );
    }

    function getStewardedLands(address steward) external view returns (uint256[] memory) {
        return stewardedLands[steward];
    }

    function getEducationalContent(uint256 contentId) external view returns (
        string memory topic,
        string memory content,
        address educator,
        uint256 timestamp,
        bool isActive
    ) {
        require(contentId < totalEducationalContent, "Content does not exist");
        EducationalContent memory edu = educationalContent[contentId];
        return (edu.topic, edu.content, edu.educator, edu.timestamp, edu.isActive);
    }

    function getContractStats() external view returns (
        uint256 _totalLandParcels,
        uint256 _totalEducationalContent,
        uint256 _totalStewards,
        uint256 _contractBalance,
        uint256 _totalSupply
    ) {
        return (
            totalLandParcels,
            totalEducationalContent,
            totalStewards,
            address(this).balance,
            totalSupply()
        );
    }

    // ==================== ADMIN ====================
    function pause() external onlyAlii {
        _pause();
    }

    function unpause() external onlyAlii {
        _unpause();
    }

    function grantAliiRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ALII_ROLE, account);
    }

    function grantKahuRole(address account) external onlyAlii {
        grantRole(KAHU_ROLE, account);
    }

    function grantEducatorRole(address account) external onlyAlii {
        grantRole(EDUCATOR_ROLE, account);
    }

    // ==================== INTERNAL ====================
    function _addInitialEducationalContent() internal {
        educationalContent[0] = EducationalContent({
            topic: "Blockchain Basics",
            content: "Blockchain is a distributed ledger technology that creates permanent, transparent records.",
            educator: msg.sender,
            timestamp: block.timestamp,
            isActive: true
        });

        educationalContent[1] = EducationalContent({
            topic: "Native Hawaiian Land Rights",
            content: "Native Hawaiians have a unique relationship with 'aina (land).",
            educator: msg.sender,
            timestamp: block.timestamp,
            isActive: true
        });

        educationalContent[2] = EducationalContent({
            topic: "Smart Contracts",
            content: "Smart contracts are self-executing agreements written in code.",
            educator: msg.sender,
            timestamp: block.timestamp,
            isActive: true
        });

        totalEducationalContent = 3;
    }

    function _removeLandFromSteward(address steward, uint256 parcelId) internal {
        uint256[] storage lands = stewardedLands[steward];
        for (uint256 i = 0; i < lands.length; i++) {
            if (lands[i] == parcelId) {
                lands[i] = lands[lands.length - 1];
                lands.pop();
                break;
            }
        }
    }

    // ==================== OVERRIDES ====================
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC20, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
