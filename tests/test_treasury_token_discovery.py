from web3 import Web3

from scripts import treasury_token_discovery as discovery


SDOLA = "0xb45ad160634c528Cc3D2926d9807104FA3157305"
FRXUSD = "0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29"
SFRXUSD = "0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6"
SPAM_ONE = "0x5e0717EcE6654C012C7Bace8625B680152883676"
SPAM_KITTIES = "0xE094b50CdD6f85Cbd331DAFb6e40735AE547d7F1"


class FakeCall:
    def __init__(self, value):
        self.value = value

    def call(self, block_identifier=None):
        return self.value


class FakeFunctions:
    def __init__(self, owner, treasury, asset, targets):
        self._owner = owner
        self._treasury = treasury
        self._asset = asset
        self._targets = targets

    def owner(self):
        return FakeCall(self._owner)

    def treasury(self):
        return FakeCall(self._treasury)

    def asset(self):
        return FakeCall(self._asset)

    def targetCount(self):
        return FakeCall(len(self._targets))

    def targets(self, target_index):
        return FakeCall(self._targets[target_index])


class FakeContract:
    def __init__(self, owner, treasury, asset, targets):
        self.functions = FakeFunctions(owner, treasury, asset, targets)


def address_topic(address):
    return "0x" + ("0" * 24) + address.removeprefix("0x").lower()


def target(token, vault=discovery.ZERO_ADDRESS):
    return (
        token,
        100,
        discovery.ZERO_ADDRESS,
        vault,
        discovery.ZERO_ADDRESS,
        discovery.ZERO_ADDRESS,
        0,
        0,
        0,
    )


def source():
    return {
        "name": "TestDiversification",
        "address": discovery.TREASURY_STABLE_DIVERSIFICATION,
        "deployment_block": 100,
        "expected_owner": discovery.CURVE_DAO_AGENT,
        "expected_treasury": discovery.CURVE_DAO_TREASURY,
        "expected_asset": discovery.CRVUSD,
    }


def test_discovery_uses_only_configured_and_historical_outputs(monkeypatch):
    contract = FakeContract(
        discovery.CURVE_DAO_AGENT,
        discovery.CURVE_DAO_TREASURY,
        discovery.CRVUSD,
        [
            target(SDOLA),
            target(FRXUSD, SFRXUSD),
        ],
    )
    logs = [
        {
            "topics": [
                discovery.TARGET_SWAPPED_TOPIC,
                "0x" + ("0" * 64),
                address_topic(FRXUSD),
                address_topic(SFRXUSD),
            ],
            "blockNumber": 123,
        }
    ]
    monkeypatch.setattr(
        discovery,
        "get_diversification_contract",
        lambda *_args: contract,
    )
    monkeypatch.setattr(
        discovery,
        "read_target_swapped_logs",
        lambda *_args, **_kwargs: logs,
    )

    result = discovery.discover_treasury_tokens(
        200,
        web3_client=Web3(),
        sources=(source(),),
    )

    assert {address.lower() for address in result["tokens"]} == {
        SDOLA.lower(),
        FRXUSD.lower(),
        SFRXUSD.lower(),
    }
    assert SPAM_ONE.lower() not in {address.lower() for address in result["tokens"]}
    assert SPAM_KITTIES.lower() not in {address.lower() for address in result["tokens"]}
    sfrxusd = next(
        item
        for item in result["provenance"]
        if item["address"].lower() == SFRXUSD.lower()
    )
    assert sfrxusd["sources"] == [
        "current_vault",
        "historical_swap_output",
    ]
    assert sfrxusd["first_seen_block"] == 123
    assert result["sources"][0]["target_swapped_event_count"] == 1


def test_discovery_fails_closed_when_source_owner_changes(monkeypatch):
    contract = FakeContract(
        "0x0000000000000000000000000000000000000001",
        discovery.CURVE_DAO_TREASURY,
        discovery.CRVUSD,
        [],
    )
    monkeypatch.setattr(
        discovery,
        "get_diversification_contract",
        lambda *_args: contract,
    )

    try:
        discovery.discover_treasury_tokens(
            200,
            web3_client=Web3(),
            sources=(source(),),
        )
    except ValueError as error:
        assert "owner mismatch" in str(error)
    else:
        raise AssertionError("Expected an owner invariant failure")
