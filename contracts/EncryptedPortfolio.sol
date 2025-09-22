// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal interface to read ownership/roles from AgentRegistry
interface IAgentRegistry {
    function agents(bytes32 agentID)
        external
        view
        returns (address owner, string memory metadataURI, bool exists);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function MANAGER_ROLE() external view returns (bytes32);
}

/// @title Encrypted Portfolio for zkAGI M1
/// @notice Stores per-agent encrypted states; creation/update gated by Agent owner or MANAGER (from AgentRegistry)
/// @dev Binds to AgentRegistry to resolve ownership and MANAGER role on-chain
contract EncryptedPortfolio {
    struct EncState {
        bytes data;    // ciphertext or sealed blob
        bytes12 iv;    // IV/nonce
        bool exists;
    }

    IAgentRegistry public immutable registry;
    mapping(bytes32 => EncState) private _enc; // key is agentID or any agreed ID

    // ===== Errors =====
    error NotAuthorized(bytes32 id, address caller);
    error StateExists(bytes32 id);
    error StateNotFound(bytes32 id);
    error AgentNotFound(bytes32 agentID);

    // ===== Events =====
    event StateCreated(bytes32 indexed id, uint256 size, address indexed caller);
    event StateUpdated(bytes32 indexed id, uint256 size, address indexed caller);

    constructor(IAgentRegistry _registry) {
        registry = _registry;
    }

    /// @notice Create a new encrypted state for an id (usually the agentID)
    /// @dev Only the agent owner or MANAGER can create; cannot overwrite
    function createState(bytes32 id, bytes calldata data, bytes12 iv) external {
        if (_enc[id].exists) revert StateExists(id);

        (address owner,, bool existsAgent) = registry.agents(id);
        if (!existsAgent) revert AgentNotFound(id);

        if (msg.sender != owner && !registry.hasRole(registry.MANAGER_ROLE(), msg.sender)) {
            revert NotAuthorized(id, msg.sender);
        }

        _enc[id] = EncState({ data: data, iv: iv, exists: true });
        emit StateCreated(id, data.length, msg.sender);
    }

    /// @notice Update an existing encrypted state for an id
    /// @dev Only the agent owner or MANAGER can update; must exist
    function updateState(bytes32 id, bytes calldata data, bytes12 iv) external {
        EncState storage s = _enc[id];
        if (!s.exists) revert StateNotFound(id);

        (address owner,, bool existsAgent) = registry.agents(id);
        if (!existsAgent) revert AgentNotFound(id);

        if (msg.sender != owner && !registry.hasRole(registry.MANAGER_ROLE(), msg.sender)) {
            revert NotAuthorized(id, msg.sender);
        }

        s.data = data;
        s.iv = iv;
        emit StateUpdated(id, data.length, msg.sender);
    }

    /// @notice Read a stored encrypted state
    function getState(bytes32 id) external view returns (bytes memory data, bytes12 iv, bool exists) {
        EncState storage s = _enc[id];
        return (s.data, s.iv, s.exists);
    }
}

