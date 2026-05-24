import re

from app.agent.schemas import AgentPlan, AgentSlots
BUY_WORDS = ("mua", "lấy", "lay", "đặt", "dat", "ship", "giao", "lên đơn", "len don")
STOCK_WORDS = ("còn", "con", "tồn", "ton", "giá", "gia")
CONSULT_WORDS = ("tư vấn", "tu van", "gợi ý", "goi y", "recommend", "nên dùng", "nen dung", "phù hợp", "phu hop")
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
    "tư",
    "tu",
    "vấn",
    "van",
    "gợi",
    "goi",
    "ý",
    "y",
    "recommend",
    "nên",
    "nen",
    "dùng",
    "dung",
    "phù",
    "phu",
    "hợp",
    "hop",
}


def parse_message(message: str, *, customer_name: str | None = None, customer_phone: str | None = None) -> AgentPlan:
    raw = message.strip()
    lower = raw.lower()
    intent = "unknown"
    if any(word in lower for word in CONSULT_WORDS) and not any(word in lower for word in BUY_WORDS):
        intent = "product_consultation"
    elif any(word in lower for word in BUY_WORDS):
        intent = "buy_product"
    elif any(word in lower for word in STOCK_WORDS):
        intent = "ask_stock"

    quantity = 1
    quantity_match = re.search(r"(\d+)\s*(cái|hop|hộp|chai|tuýp|túyp|gói|goi|sp|sản phẩm)?", lower)
    if quantity_match:
        quantity = max(int(quantity_match.group(1)), 1)

    phone = extract_phone(raw) or customer_phone

    address = extract_address(raw)
    parsed_name = extract_customer_name(raw)
    payment_method = extract_payment_method(raw)
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
            customer_name=parsed_name or customer_name,
            customer_phone=phone,
            shipping_address=address,
            payment_method=payment_method,
        ),
        tool_plan=tool_plan,
        source="rule",
    )


def extract_address(message: str) -> str | None:
    match = re.search(
        r"(?:giao\s*(?:tới|đến)|dia chi|địa chỉ)\s*[:,]?\s*(.+?)(?:[,.]?\s*(?:sđt|sdt|số điện thoại|so dien thoai|chị\s+là|chi\s+la|tên\s+(?:chị|em|mình)|ten\s+(?:chi|em|minh)|người\s+nhận|nguoi\s+nhan|thanh\s+toán|thanh\s+toan|trả\s+tiền|tra\s+tien|nhận\s*(?:hàng)?\s*(?:vào|lúc|giờ)|nhan\s*(?:hang)?\s*(?:vao|luc|gio)|giờ\s+nhận|gio\s+nhan)\b|$)",
        message,
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    return match.group(1).strip(" .,")


def extract_customer_name(message: str) -> str | None:
    patterns = [
        r"(?:chị\s+là|chi\s+la|em\s+là|mình\s+là|minh\s+la)\s+([^,.]+)",
        r"(?:tên\s+(?:chị|em|mình)|ten\s+(?:chi|em|minh)|người\s+nhận|nguoi\s+nhan)\s*[:,]?\s*([^,.]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, flags=re.IGNORECASE)
        if match:
            name = match.group(1).strip(" .,:")
            if name:
                return name
    return None


def extract_payment_method(message: str) -> str | None:
    lower = message.lower()
    if any(token in lower for token in ("qr", "chuyển khoản", "chuyen khoan", "trả trước", "tra truoc", "thanh toán trước", "thanh toan truoc")):
        return "prepaid"
    if any(token in lower for token in ("cod", "nhận hàng", "nhan hang", "trả sau", "tra sau", "thanh toán khi nhận", "thanh toan khi nhan")):
        return "cod"
    return None


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
