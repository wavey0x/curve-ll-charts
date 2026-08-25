from decimal import Decimal

from web3 import Web3

from crv_lol import treasury as balance_sheet


SDOLA = Web3.to_checksum_address("0xb45ad160634c528Cc3D2926d9807104FA3157305")
FRXUSD = Web3.to_checksum_address("0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29")
SFRXUSD = Web3.to_checksum_address("0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6")


class FakeEth:
    @staticmethod
    def get_block(_block_identifier):
        return {"number": 25_631_147, "timestamp": 1_775_000_000}


class FakeWeb3:
    eth = FakeEth()
    to_checksum_address = staticmethod(Web3.to_checksum_address)


def test_dynamic_positive_balances_are_shown_and_only_they_are_priced(
    monkeypatch,
):
    monkeypatch.setattr(balance_sheet, "web3", FakeWeb3())
    monkeypatch.setattr(
        balance_sheet,
        "discover_treasury_tokens",
        lambda *_args, **_kwargs: {
            "tokens": [SDOLA, FRXUSD, SFRXUSD],
            "provenance": [],
            "sources": [],
            "last_scanned_block": 25_631_147,
        },
    )

    symbols = {
        balance_sheet.CRV.lower(): "CRV",
        balance_sheet.CRVUSD.lower(): "crvUSD",
        balance_sheet.SCRVUSD.lower(): "scrvUSD",
        balance_sheet.USDC.lower(): "USDC",
        SDOLA.lower(): "sDOLA",
        FRXUSD.lower(): "frxUSD",
        SFRXUSD.lower(): "sfrxUSD",
    }
    metadata_blocks = []

    def fake_metadata(token_address, block_identifier):
        metadata_blocks.append(block_identifier)
        return {
            "symbol": symbols[token_address.lower()],
            "decimals": 18,
        }

    balance_blocks = []

    def fake_wallet_token_data(
        wallet_address,
        token_address,
        block_identifier,
    ):
        balance_blocks.append(block_identifier)
        balance = Decimal("0")
        if wallet_address.lower() == balance_sheet.TREASURY.lower():
            if token_address.lower() == SDOLA.lower():
                balance = Decimal("10")
            elif token_address.lower() == SFRXUSD.lower():
                balance = Decimal("20")
        return {
            "symbol": symbols[token_address.lower()],
            "decimals": 18,
            "raw_balance": str(int(balance * Decimal(10**18))),
            "balance": balance,
        }

    priced_tokens = []

    def fake_fetch_price(token_address, chain_id=1):
        priced_tokens.append(token_address.lower())
        if token_address.lower() == SFRXUSD.lower():
            raise ValueError("temporary price outage")
        return {
            "price": Decimal("1.4"),
            "logo_url": "",
            "status": "priced",
        }

    monkeypatch.setattr(balance_sheet, "get_token_metadata", fake_metadata)
    monkeypatch.setattr(
        balance_sheet,
        "get_wallet_token_data",
        fake_wallet_token_data,
    )
    monkeypatch.setattr(
        balance_sheet,
        "get_treasury_crv_return_from_vest",
        lambda _block_identifier: Decimal("0"),
    )
    monkeypatch.setattr(
        balance_sheet,
        "fetch_price_snapshot",
        fake_fetch_price,
    )

    result = balance_sheet.build_treasury_balance_sheet()
    treasury_rows = result["wallets"][0]["rows"]

    assert [row["symbol"] for row in treasury_rows] == ["sDOLA", "sfrxUSD"]
    assert set(priced_tokens) == {SDOLA.lower(), SFRXUSD.lower()}
    assert FRXUSD.lower() not in priced_tokens
    assert treasury_rows[0]["usd_value"] == "14"
    assert treasury_rows[1]["usd_value"] is None
    assert treasury_rows[1]["pricing_status"] == "unpriced"
    assert treasury_rows[1]["logo_url"].endswith(f"/{SFRXUSD.lower()}.png")
    assert result["grand_total_usd"] == "14"
    assert result["displayed_token_count"] == 2
    assert result["unpriced_token_count"] == 1
    assert result["totals_are_partial"] is True
    assert result["captured_block"] == 25_631_147
    assert set(metadata_blocks) == {25_631_147}
    assert set(balance_blocks) == {25_631_147}
