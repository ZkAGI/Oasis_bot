// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Strategy Store for zkAGI M1
/// @notice Stores strategy payloads (ideally encrypted/hash commitments)
/// @dev MANAGER controls writes. Read is public by default.
contract StrategyStore is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    // Optional: bytes32 public constant READER_ROLE  = keccak256("READER_ROLE");

    mapping(bytes32 => bytes) private _store;

    // ===== Errors =====
    error StrategyExists(bytes32 id);
    error StrategyNotFound(bytes32 id);

    // ===== Events =====
    event StrategyCreated(bytes32 indexed id, uint256 size, address indexed caller);
    event StrategyUpdated(bytes32 indexed id, uint256 size, address indexed caller);
    event StrategyDeleted(bytes32 indexed id, address indexed caller);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    /// @notice Create a new strategy record; reverts if it already exists
    function createStrategy(bytes32 id, bytes calldata payload) external onlyRole(MANAGER_ROLE) {
        if (_store[id].length != 0) revert StrategyExists(id);
        _store[id] = payload;
        emit StrategyCreated(id, payload.length, msg.sender);
    }

    /// @notice Update an existing strategy record; reverts if it does not exist
    function updateStrategy(bytes32 id, bytes calldata payload) external onlyRole(MANAGER_ROLE) {
        if (_store[id].length == 0) revert StrategyNotFound(id);
        _store[id] = payload;
        emit StrategyUpdated(id, payload.length, msg.sender);
    }

    /// @notice Delete an existing strategy record
    function deleteStrategy(bytes32 id) external onlyRole(MANAGER_ROLE) {
        if (_store[id].length == 0) revert StrategyNotFound(id);
        delete _store[id];
        emit StrategyDeleted(id, msg.sender);
    }

    /// @notice Read a stored strategy payload
    /// @dev If you want to restrict read access, swap with: onlyRole(READER_ROLE)
    function getStrategy(bytes32 id) external view returns (bytes memory) {
        bytes memory s = _store[id];
        if (s.length == 0) revert StrategyNotFound(id);
        return s;
    }
}

