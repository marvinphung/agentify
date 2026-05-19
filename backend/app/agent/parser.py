import re

from app.agent.schemas import AgentPlan, AgentSlots
BUY_WORDS = ("mua", "lấy", "lay", "đặt", "dat", "ship", "giao", "lên đơn", "len don")
STOCK_WORDS = ("còn", "con", "tồn", "ton", "giá", "gia")
STOPWORDS = {
    "anh",
    "chị",
    "chi",
    "em",
    "mình",
    "minh",
    "muốn",
    "muon",
    "mua",
    "lấy",
    "lay",
    "đặt",
    "dat",
    "cho",
    "shop",
    "còn",
    "con",
    "hàng",
    "hang",
    "không",
    "khong",
    "giao",
    "tới",
    "toi",
    "đến",
    "den",
    "địa",
    "dia",
    "chỉ",
    "chi",
    "sdt",
    "sđt",
}


def parse_message(message: str, *, customer_name: str | None = None, customer_phone: str | None = None) -> AgentPlan:
    raw = message.strip()
    lower = raw.lower()
    intent = "unknown"
    if any(word in lower for word in BUY_WORDS):
        intent = "buy_product"
    elif any(word in lower for word in STOCK_WORDS):
        intent = "ask_stock"

    quantity = 1
    quantity_match = re.search(r"(\d+)\s*(cái|hop|hộp|chai|tuýp|túyp|gói|goi|sp|sản phẩm)?", lower)
    if quantity_match:
        quantity = max(int(quantity_match.group(1)), 1)

    phone = customer_phone or extract_phone(raw)

    address = extract_address(raw)
    product_query = extract_product_query(raw)
    tool_plan = ["search_products", "check_stock"]
    if intent == "buy_product":
        tool_plan.append("create_draft_order")
    elif intent == "unknown":
        tool_plan = ["ask_clarification"]

    return AgentPlan(
        intent=intent,
        slots=AgentSlots(
            product_query=product_query,
            quantity=quantity,
            customer_name=customer_name,
            customer_phone=phone,
            shipping_address=address,
        ),
        tool_plan=tool_plan,
        source="rule",
    )


def extract_address(message: str) -> str | None:
    match = re.search(r"(?:giao\s*(?:tới|đến)|dia chi|địa chỉ)\s*[:,]?\s*(.+?)(?:,?\s*(?:sđt|sdt|số điện thoại|so dien thoai)\b|$)", message, flags=re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip(" .,")


def extract_phone(message: str) -> str | None:
    labeled = re.search(r"(?:sđt|sdt|số điện thoại|so dien thoai)\s*[:,]?\s*(0\d{8,10}|\+?84\d{8,10})", message, flags=re.IGNORECASE)
    if labeled:
        return labeled.group(1)
    phone = re.search(r"\b(0\d{8,10}|\+?84\d{8,10})\b", message)
    return phone.group(1) if phone else None


def extract_product_query(message: str) -> str | None:
    text = re.sub(r"(?:sđt|sdt|số điện thoại|so dien thoai)\s*[:,]?\s*\d+", " ", message, flags=re.IGNORECASE)
    text = re.sub(r"(?:giao\s*(?:tới|đến)|dia chi|địa chỉ)\s*[:,]?\s*.+$", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\d+\s*(cái|hop|hộp|chai|tuýp|túyp|gói|goi|sp|sản phẩm)?", " ", text, flags=re.IGNORECASE)
    tokens = [token.strip(" ,.!?;:").lower() for token in text.split()]
    kept = [token for token in tokens if token and token not in STOPWORDS]
    return " ".join(kept).strip() or None
