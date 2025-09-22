// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Agent Registry for zkAGI M1
/// @notice Registers agents and their metadata; owner is explicit and can differ from MANAGER
/// @dev MANAGER can create agents; updates allowed by agent owner or MANAGER
contract AgentRegistry is AccessControl {
    /// @dev Role that can create/update agents
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Agent record
    struct Agent {
        address owner;
        string metadataURI;
        bool exists;
    }

    /// @notice agentID => Agent
    mapping(bytes32 => Agent) private _agents;

    // ===== Errors =====
    error AgentExists(bytes32 agentID);
    error AgentNotFound(bytes32 agentID);
    error NotAuthorized(bytes32 agentID, address caller);
    error ZeroAddress();

    // ===== Events =====
    event AgentCreated(bytes32 indexed agentID, address indexed owner, string metadataURI);
    event AgentUpdated(bytes32 indexed agentID, string metadataURI, address indexed caller);
    event AgentOwnerTransferred(bytes32 indexed agentID, address indexed oldOwner, address indexed newOwner);

    /// @param admin Admin who will receive DEFAULT_ADMIN_ROLE and MANAGER_ROLE
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    /// @notice View an agent by ID
    function agents(bytes32 agentID) external view returns (address owner, string memory metadataURI, bool exists) {
        Agent storage a = _agents[agentID];
        return (a.owner, a.metadataURI, a.exists);
    }

    /// @notice Create a new agent
    /// @param agentID Unique ID (e.g., keccak hash)
    /// @param owner Address to be recorded as agent owner (can be a user)
    /// @param uri Arbitrary metadata (IPFS/HTTPS)
    function createAgent(bytes32 agentID, address owner, string calldata uri)
        external
        onlyRole(MANAGER_ROLE)
    {
        if (owner == address(0)) revert ZeroAddress();
        if (_agents[agentID].exists) revert AgentExists(agentID);

        _agents[agentID] = Agent({ owner: owner, metadataURI: uri, exists: true });
        emit AgentCreated(agentID, owner, uri);
    }

    /// @notice Update agent metadata
    /// @dev Callable by agent owner or MANAGER
    function updateAgent(bytes32 agentID, string calldata uri) external {
        Agent storage a = _agents[agentID];
        if (!a.exists) revert AgentNotFound(agentID);
        if (msg.sender != a.owner && !hasRole(MANAGER_ROLE, msg.sender)) {
            revert NotAuthorized(agentID, msg.sender);
        }
        a.metadataURI = uri;
        emit AgentUpdated(agentID, uri, msg.sender);
    }

    /// @notice Transfer agent ownership
    /// @dev Callable by current owner or MANAGER
    function transferAgentOwner(bytes32 agentID, address newOwner) external {
        if (newOwner == address(0)) revert ZeroAddress();
        Agent storage a = _agents[agentID];
        if (!a.exists) revert AgentNotFound(agentID);
        if (msg.sender != a.owner && !hasRole(MANAGER_ROLE, msg.sender)) {
            revert NotAuthorized(agentID, msg.sender);
        }
        address old = a.owner;
        a.owner = newOwner;
        emit AgentOwnerTransferred(agentID, old, newOwner);
    }
}

