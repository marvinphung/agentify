from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.kiotviet.service import COSMETIC_DEMO_PRODUCTS, seed_cosmetic_products
from app.models import AgentAction, Conversation, Customer, Message, Order, ProductCache
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


DEMO_CUSTOMER_NAME = "Nguyễn Thảo"
DEMO_CUSTOMER_PHONE = "0901234567"
DEMO_CUSTOMER_ADDRESS = "12 Nguyễn Trãi, Hà Nội"


def seed_demo_data(db: Session) -> None:
    ensure_default_workspace(db)
    if _product_count(db) == 0:
        seed_cosmetic_products(db)
    customer = _ensure_demo_customer(db)
    conversation = _ensure_demo_conversation(db, customer.id)
    _ensure_demo_order(db, customer.id, conversation.id)
    db.commit()


def _product_count(db: Session) -> int:
    return len(list(db.scalars(select(ProductCache.id).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID).limit(1))))


def _ensure_demo_customer(db: Session) -> Customer:
    customer = db.scalar(
        select(Customer).where(
            Customer.workspace_id == DEFAULT_WORKSPACE_ID,
            Customer.phone == DEMO_CUSTOMER_PHONE,
            Customer.channel == "user_chat",
        )
    )
    if customer:
        customer.name = DEMO_CUSTOMER_NAME
        return customer
    customer = Customer(
        workspace_id=DEFAULT_WORKSPACE_ID,
        name=DEMO_CUSTOMER_NAME,
        phone=DEMO_CUSTOMER_PHONE,
        channel="user_chat",
    )
    db.add(customer)
    db.flush()
    return customer


def _ensure_demo_conversation(db: Session, customer_id: int) -> Conversation:
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.workspace_id == DEFAULT_WORKSPACE_ID,
            Conversation.customer_id == customer_id,
            Conversation.channel == "user_chat",
        )
    )
    if conversation:
        return conversation
    conversation = Conversation(
        workspace_id=DEFAULT_WORKSPACE_ID,
        customer_id=customer_id,
        channel="user_chat",
        status="order_created",
    )
    db.add(conversation)
    db.flush()
    db.add(Message(conversation_id=conversation.id, sender="ai", content=f"Chào chị {DEMO_CUSTOMER_NAME}, Lumi Beauty có thể hỗ trợ chị tư vấn sản phẩm, đặt hàng hoặc chăm sóc sau mua ạ."))
    db.add(Message(conversation_id=conversation.id, sender="customer", content="Đặt serum vitamin C"))
    db.add(Message(conversation_id=conversation.id, sender="ai", content="Dạ chị Nguyễn Thảo, serum vitamin C sáng da 30ml phù hợp nhu cầu làm sáng và đều màu da. Nếu chị muốn đặt sản phẩm này, chị nhắn Đồng ý đặt giúp em. Em cảm ơn chị."))
    return conversation


def _ensure_demo_order(db: Session, customer_id: int, conversation_id: int) -> Order:
    order = db.scalar(
        select(Order).where(
            Order.workspace_id == DEFAULT_WORKSPACE_ID,
            Order.customer_phone == DEMO_CUSTOMER_PHONE,
        )
    )
    if order:
        return order
    product = _demo_order_product(db)
    price = Decimal(str(product.base_price))
    item = {
        "product_id": product.id,
        "kiotviet_product_id": product.kiotviet_product_id,
        "name": product.name,
        "quantity": 1,
        "price": float(price),
    }
    order = Order(
        workspace_id=DEFAULT_WORKSPACE_ID,
        conversation_id=conversation_id,
        customer_id=customer_id,
        status="draft",
        total=price,
        customer_name=DEMO_CUSTOMER_NAME,
        customer_phone=DEMO_CUSTOMER_PHONE,
        shipping_address=DEMO_CUSTOMER_ADDRESS,
        items=[item],
        raw_json={"source": "seed", "payment_method": "cod"},
    )
    db.add(order)
    db.flush()
    db.add(AgentAction(conversation_id=conversation_id, action_type="seed", status="success", summary=f"Đã tạo đơn mẫu #{order.id}.", raw_json={"order_id": order.id}))
    return order


def _demo_order_product(db: Session) -> ProductCache:
    product = db.scalar(
        select(ProductCache).where(
            ProductCache.workspace_id == DEFAULT_WORKSPACE_ID,
            ProductCache.code == "MP018",
        )
    )
    if product:
        return product
    seed_cosmetic_products(db)
    product = db.scalar(
        select(ProductCache).where(
            ProductCache.workspace_id == DEFAULT_WORKSPACE_ID,
            ProductCache.code == "MP018",
        )
    )
    if product:
        return product
    fallback = COSMETIC_DEMO_PRODUCTS[0]
    product = ProductCache(
        workspace_id=DEFAULT_WORKSPACE_ID,
        kiotviet_product_id=fallback["id"],
        code=fallback["code"],
        name=fallback["name"],
        base_price=Decimal(str(fallback["basePrice"])),
        stock=fallback["stock"],
        raw_json=fallback,
    )
    db.add(product)
    db.flush()
    return product
