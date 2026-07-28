"""Discover treasury assets from governance-authorized diversification contracts.

This module intentionally does not inspect arbitrary ERC-20 transfers or wallet
token lists. A token is eligible only when it is configured by a trusted source
contract, or when that contract emitted it as the output of a historical swap.
"""

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

TREASURY_STABLE_DIVERSIFICATION = "0x70b3d2c2A508A87f9C18F46fe9ca42307CD021f7"
TREASURY_STABLE_DIVERSIFICATION_DEPLOYMENT_BLOCK = 25_563_538
CURVE_DAO_AGENT = "0x40907540d8a6C65c637785e8f8B742ae6b0b9968"
CURVE_DAO_TREASURY = "0x6508eF65b0Bd57eaBD0f1D52685A70433B2d290B"
CRVUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E"

# keccak256("TargetSwapped(uint256,address,uint256,uint256,address,uint256)")
TARGET_SWAPPED_TOPIC = (
    "0xc91954406e7449e8fb3c6380c962e06283513f3a239954c4c8c312e1d961171e"
)
DEFAULT_LOG_CHUNK_SIZE = 40_000
MAX_TARGET_COUNT = 32

DEFAULT_SOURCES = (
    {
        "name": "TreasuryStableDiversification",
        "address": TREASURY_STABLE_DIVERSIFICATION,
        "deployment_block": TREASURY_STABLE_DIVERSIFICATION_DEPLOYMENT_BLOCK,
        "expected_owner": CURVE_DAO_AGENT,
        "expected_treasury": CURVE_DAO_TREASURY,
        "expected_asset": CRVUSD,
    },
)

DIVERSIFICATION_ABI = [
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "treasury",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "asset",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "targetCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "", "type": "uint256"}],
        "name": "targets",
        "outputs": [
            {"name": "token", "type": "address"},
            {"name": "weight", "type": "uint256"},
            {"name": "swapPool", "type": "address"},
            {"name": "vault", "type": "address"},
            {"name": "inputToken", "type": "address"},
            {"name": "stakedAsset", "type": "address"},
            {"name": "maxPrice", "type": "uint256"},
            {"name": "maxSpotEmaDeviationBps", "type": "uint16"},
            {"name": "executionBufferBps", "type": "uint16"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]


def _get_web3(web3_client):
    if web3_client is not None:
        return web3_client

    from brownie import web3

    return web3


def _checksum(web3_client, address):
    return web3_client.to_checksum_address(address)


def _same_address(left, right):
    return left.lower() == right.lower()


def _topic_address(web3_client, topic):
    topic_hex = topic.hex() if hasattr(topic, "hex") else str(topic)
    topic_hex = topic_hex.removeprefix("0x")
    if len(topic_hex) != 64:
        raise ValueError(f"Invalid indexed address topic: {topic}")
    return _checksum(web3_client, f"0x{topic_hex[-40:]}")


def get_diversification_contract(web3_client, address):
    return web3_client.eth.contract(
        address=_checksum(web3_client, address),
        abi=DIVERSIFICATION_ABI,
    )


def read_target_swapped_logs(
    web3_client,
    source_address,
    from_block,
    to_block,
    chunk_size=DEFAULT_LOG_CHUNK_SIZE,
):
    """Read trusted TargetSwapped logs in RPC-friendly inclusive chunks."""
    if from_block > to_block:
        return []

    logs = []
    chunk_start = from_block
    while chunk_start <= to_block:
        chunk_end = min(chunk_start + chunk_size - 1, to_block)
        logs.extend(
            web3_client.eth.get_logs(
                {
                    "address": _checksum(web3_client, source_address),
                    "topics": [TARGET_SWAPPED_TOPIC],
                    "fromBlock": chunk_start,
                    "toBlock": chunk_end,
                }
            )
        )
        chunk_start = chunk_end + 1
    return logs


def _add_candidate(
    web3_client,
    candidates,
    address,
    provenance,
    source_contract,
    first_seen_block,
):
    if _same_address(address, ZERO_ADDRESS):
        return

    checksummed = _checksum(web3_client, address)
    key = checksummed.lower()
    candidate = candidates.setdefault(
        key,
        {
            "address": checksummed,
            "sources": set(),
            "source_contracts": set(),
            "first_seen_block": first_seen_block,
        },
    )
    candidate["sources"].add(provenance)
    candidate["source_contracts"].add(_checksum(web3_client, source_contract))
    candidate["first_seen_block"] = min(
        candidate["first_seen_block"],
        first_seen_block,
    )


def _validate_source(web3_client, source, contract, block_number):
    actual = {
        "owner": contract.functions.owner().call(block_identifier=block_number),
        "treasury": contract.functions.treasury().call(block_identifier=block_number),
        "asset": contract.functions.asset().call(block_identifier=block_number),
    }
    expected = {
        "owner": source["expected_owner"],
        "treasury": source["expected_treasury"],
        "asset": source["expected_asset"],
    }

    for field, expected_address in expected.items():
        if not _same_address(actual[field], expected_address):
            raise ValueError(
                f"{source['name']} {field} mismatch at block {block_number}: "
                f"expected {expected_address}, got {actual[field]}"
            )

    return {field: _checksum(web3_client, address) for field, address in actual.items()}


def discover_treasury_tokens(
    block_number,
    web3_client=None,
    sources=DEFAULT_SOURCES,
):
    """Return tokens approved by trusted sources as of ``block_number``.

    Current target tokens/vaults and historical TargetSwapped outputs are
    included. Any positive-balance filtering happens later in the balance-sheet
    builder so formerly configured outputs are retained without surfacing empty
    rows.
    """
    web3_client = _get_web3(web3_client)
    candidates = {}
    source_summaries = []

    for source in sources:
        if source["deployment_block"] > block_number:
            continue

        contract = get_diversification_contract(
            web3_client,
            source["address"],
        )
        invariants = _validate_source(
            web3_client,
            source,
            contract,
            block_number,
        )
        target_count = contract.functions.targetCount().call(
            block_identifier=block_number
        )
        if target_count > MAX_TARGET_COUNT:
            raise ValueError(
                f"{source['name']} target count {target_count} exceeds "
                f"safety limit {MAX_TARGET_COUNT}"
            )

        for target_index in range(target_count):
            target = contract.functions.targets(target_index).call(
                block_identifier=block_number
            )
            token = target[0]
            vault = target[3]
            _add_candidate(
                web3_client,
                candidates,
                token,
                "current_target",
                source["address"],
                block_number,
            )
            _add_candidate(
                web3_client,
                candidates,
                vault,
                "current_vault",
                source["address"],
                block_number,
            )

        logs = read_target_swapped_logs(
            web3_client,
            source["address"],
            source["deployment_block"],
            block_number,
        )
        for log in logs:
            topics = log["topics"]
            if len(topics) < 4:
                raise ValueError(
                    f"Malformed TargetSwapped log from {source['address']}"
                )
            # index and token are indexed first; vault is the final indexed arg.
            token = _topic_address(web3_client, topics[2])
            vault = _topic_address(web3_client, topics[3])
            output_token = vault if not _same_address(vault, ZERO_ADDRESS) else token
            _add_candidate(
                web3_client,
                candidates,
                output_token,
                "historical_swap_output",
                source["address"],
                log["blockNumber"],
            )

        source_summaries.append(
            {
                "name": source["name"],
                "address": _checksum(web3_client, source["address"]),
                "deployment_block": source["deployment_block"],
                "last_scanned_block": block_number,
                "target_count": target_count,
                "target_swapped_event_count": len(logs),
                **invariants,
            }
        )

    provenance = []
    for candidate in sorted(
        candidates.values(),
        key=lambda item: item["address"].lower(),
    ):
        provenance.append(
            {
                **candidate,
                "sources": sorted(candidate["sources"]),
                "source_contracts": sorted(
                    candidate["source_contracts"],
                    key=str.lower,
                ),
            }
        )

    return {
        "tokens": [candidate["address"] for candidate in provenance],
        "provenance": provenance,
        "sources": source_summaries,
        "last_scanned_block": block_number,
    }
