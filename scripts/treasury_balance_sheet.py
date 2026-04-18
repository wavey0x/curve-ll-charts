import os
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

import requests
from brownie import chain, web3

TREASURY = "0x6508eF65b0Bd57eaBD0f1D52685A70433B2d290B"
COMMUNITY_FUND = "0xe3997288987E6297Ad550A69B31439504F513267"
GRANTS_MULTISIG = "0xc420C9d507D0E038BD76383AaADCAd576ed0073c"
TREASURY_RETURN_VEST = "0x76CA4c65a3411a6bA859Ac738fbC7055f28A611E"

CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52"
CRVUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E"
SCRVUSD = "0x0655977FEb2f289A4aB78af67BAB0d17aAb84367"
USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

WAVEY_PRICE_API = "https://prices.wavey.info/v1/price"
ENV_KEY_NAMES = (
    "TOKEN_PRICE_AGG_KEY",
    "TIDAL_DEPLOY_PRICE_API_KEY",
    "FACTORY_DASHBOARD_DEPLOY_PRICE_API_KEY",
)
ENV_FILE_PATHS = (
    Path(__file__).resolve().parents[1] / ".env",
)

ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
]

FLEXIBLE_VESTING_RECEIVER_ABI = [
    {
        "inputs": [],
        "name": "total_amount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "available_limit",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def decimal_to_string(value):
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def load_env_value_from_files(*keys):
    for env_path in ENV_FILE_PATHS:
        if not env_path.exists():
            continue

        values = {}
        for line in env_path.read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)
            values[key.strip()] = value.strip().strip("'\"")

        for key in keys:
            if values.get(key):
                return values[key]

    return None


TOKEN_PRICE_AGG_KEY = next(
    (os.getenv(key_name) for key_name in ENV_KEY_NAMES if os.getenv(key_name)),
    None,
) or load_env_value_from_files(*ENV_KEY_NAMES)


@lru_cache(maxsize=None)
def get_erc20_contract(token_address):
    return web3.eth.contract(
        address=web3.to_checksum_address(token_address),
        abi=ERC20_ABI,
    )


@lru_cache(maxsize=None)
def get_token_metadata(token_address):
    token = get_erc20_contract(token_address)
    return {
        "symbol": token.functions.symbol().call(),
        "decimals": token.functions.decimals().call(),
    }


def get_wallet_token_data(wallet_address, token_address):
    token = get_erc20_contract(token_address)
    metadata = get_token_metadata(token_address)
    raw_balance = token.functions.balanceOf(
        web3.to_checksum_address(wallet_address)
    ).call()
    decimals = Decimal(10) ** metadata["decimals"]
    balance = Decimal(raw_balance) / decimals

    return {
        "symbol": metadata["symbol"],
        "decimals": metadata["decimals"],
        "raw_balance": str(raw_balance),
        "balance": balance,
    }


def fetch_price_snapshot(token_address, chain_id=1):
    headers = {}
    if TOKEN_PRICE_AGG_KEY:
        headers["Authorization"] = f"Bearer {TOKEN_PRICE_AGG_KEY}"

    response = requests.get(
        WAVEY_PRICE_API,
        params={"token": token_address, "chain_id": chain_id},
        headers=headers,
        timeout=30,
    )
    payload = response.json()

    if response.ok and payload.get("summary"):
        summary = payload["summary"]
        selected_price = (payload.get("price_data") or {}).get("price")
        price = summary.get("median_price") or selected_price
        if price is not None:
            logo_url = (payload.get("token") or {}).get("logo_url") or ""
            return {
                "price": Decimal(str(price)),
                "logo_url": logo_url,
            }

    raise ValueError(f"Price lookup failed for {token_address}: {payload}")


def get_treasury_crv_return_from_vest():
    vest_receiver = web3.eth.contract(
        address=web3.to_checksum_address(TREASURY_RETURN_VEST),
        abi=FLEXIBLE_VESTING_RECEIVER_ABI,
    )
    total_amount = Decimal(
        vest_receiver.functions.total_amount().call()
    ) / Decimal(10**18)
    available_limit = Decimal(
        vest_receiver.functions.available_limit().call()
    ) / Decimal(10**18)
    # Governance updates can raise the available limit to the full vest amount.
    # Once that happens, nothing remains earmarked to return to the DAO.
    return max(total_amount - available_limit, Decimal("0"))


def build_balance_row(label, token_address, balance, price_snapshot, raw_balance, kind="token"):
    metadata = get_token_metadata(token_address)
    unit_price = price_snapshot["price"]
    usd_value = balance * unit_price
    return {
        "label": label,
        "symbol": metadata["symbol"],
        "token_address": web3.to_checksum_address(token_address),
        "kind": kind,
        "logo_url": price_snapshot.get("logo_url", ""),
        "raw_balance": raw_balance,
        "balance": decimal_to_string(balance),
        "unit_price": decimal_to_string(unit_price),
        "usd_value": decimal_to_string(usd_value),
    }, usd_value


def build_treasury_balance_sheet():
    latest_block = web3.eth.get_block("latest")
    wallets = [
        ("Treasury", TREASURY),
        ("Community Fund", COMMUNITY_FUND),
        ("Grants Multisig", GRANTS_MULTISIG),
    ]
    tokens = [CRV, CRVUSD, SCRVUSD, USDC]
    price_snapshots = {
        token: fetch_price_snapshot(token) for token in tokens
    }

    wallet_rows = []
    grand_total = Decimal("0")
    vest_return_active = False

    for wallet_name, wallet_address in wallets:
        detail_rows = []

        for token_address in tokens:
            token_data = get_wallet_token_data(wallet_address, token_address)
            if token_data["balance"] <= 0:
                continue

            row, usd_value = build_balance_row(
                label=token_data["symbol"],
                token_address=token_address,
                balance=token_data["balance"],
                price_snapshot=price_snapshots[token_address],
                raw_balance=token_data["raw_balance"],
            )
            detail_rows.append(row)
            grand_total += usd_value

        if wallet_name == "Community Fund":
            vest_return_balance = get_treasury_crv_return_from_vest()
            if vest_return_balance > 0:
                vest_return_active = True
                row, usd_value = build_balance_row(
                    label="*CRV (vest return)",
                    token_address=CRV,
                    balance=vest_return_balance,
                    price_snapshot=price_snapshots[CRV],
                    raw_balance=str(int(vest_return_balance * Decimal(10**18))),
                    kind="vest_return",
                )
                detail_rows.append(row)
                grand_total += usd_value

        wallet_total = sum(
            (Decimal(row["usd_value"]) for row in detail_rows),
            Decimal("0"),
        )
        wallet_rows.append(
            {
                "name": wallet_name,
                "address": web3.to_checksum_address(wallet_address),
                "rows": detail_rows,
                "total_usd": decimal_to_string(wallet_total),
            }
        )

    footnotes = []
    if vest_return_active:
        footnotes.append(
            {
                "label": "*",
                "text": "To be returned to DAO at completion of vest",
                "address": web3.to_checksum_address(TREASURY_RETURN_VEST),
            }
        )

    return {
        "title": "Treasury Wallet Balances",
        "currency": "USD",
        "captured_at": latest_block["timestamp"],
        "captured_block": latest_block["number"],
        "wallet_count": len(wallet_rows),
        "token_count": len(tokens),
        "wallets": wallet_rows,
        "grand_total_usd": decimal_to_string(grand_total),
        "footnotes": footnotes,
        "last_updated": chain.time(),
    }
