import mimetypes
import os
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

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
LOGO_CACHE_ROOT = Path("cache/token-logos")
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


def infer_logo_extension(logo_url, response):
    suffix = Path(urlparse(logo_url).path).suffix.lower()
    if suffix:
        return suffix

    content_type = response.headers.get("Content-Type", "").split(";")[0].strip()
    extension = mimetypes.guess_extension(content_type)
    return extension or ".png"


def get_cached_logo_filename(token_address, chain_id=1):
    cache_dir = LOGO_CACHE_ROOT / str(chain_id)
    if not cache_dir.exists():
        return ""

    token_key = web3.to_checksum_address(token_address).lower()
    matches = sorted(cache_dir.glob(f"{token_key}.*"))
    if not matches:
        return ""
    return matches[0].name


def build_logo_path(chain_id, filename):
    return f"/api/crvlol/token-logos/{chain_id}/{filename}"


def cache_token_logo(token_address, logo_url, chain_id=1):
    if not logo_url:
        return ""

    cached_filename = get_cached_logo_filename(token_address, chain_id=chain_id)
    if cached_filename:
        return build_logo_path(chain_id, cached_filename)

    cache_dir = LOGO_CACHE_ROOT / str(chain_id)
    cache_dir.mkdir(parents=True, exist_ok=True)

    response = requests.get(logo_url, timeout=30)
    response.raise_for_status()

    extension = infer_logo_extension(logo_url, response)
    token_key = web3.to_checksum_address(token_address).lower()
    filename = f"{token_key}{extension}"
    (cache_dir / filename).write_bytes(response.content)
    return build_logo_path(chain_id, filename)


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
            try:
                logo_path = cache_token_logo(token_address, logo_url, chain_id=chain_id)
            except (requests.RequestException, OSError):
                logo_path = ""

            return {
                "price": Decimal(str(price)),
                "logo_url": logo_url,
                "logo_path": logo_path,
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
    return total_amount - available_limit


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
        "logo_path": price_snapshot.get("logo_path", ""),
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

    return {
        "title": "Treasury Wallet Balances",
        "currency": "USD",
        "captured_at": latest_block["timestamp"],
        "captured_block": latest_block["number"],
        "wallet_count": len(wallet_rows),
        "token_count": len(tokens),
        "wallets": wallet_rows,
        "grand_total_usd": decimal_to_string(grand_total),
        "footnotes": [
            {
                "label": "*",
                "text": "To be returned to DAO at completion of vest",
                "address": web3.to_checksum_address(TREASURY_RETURN_VEST),
            }
        ],
        "last_updated": chain.time(),
    }
