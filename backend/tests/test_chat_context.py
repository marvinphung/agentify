from decimal import Decimal

from app.agent.chat_router import _recommend_products, _resolve_active_product_focus
from app.models import ProductCache


def _product(product_id: int, name: str, price: int = 100000) -> ProductCache:
    return ProductCache(
        id=product_id,
        workspace_id=1,
        kiotviet_product_id=product_id,
        code=f"MP{product_id}",
        name=name,
        base_price=Decimal(price),
        stock=10,
        raw_json={},
    )


def test_resolve_active_product_focus_from_previous_message():
    history = [
        {"role": "user", "content": "mua tẩy da chết"},
        {"role": "assistant", "content": "Dạ chị, em có Tẩy da chết enzyme dịu nhẹ 80g."},
        {"role": "user", "content": "chị là da nhạy cảm, tư vấn loại phù hợp"},
    ]

    assert _resolve_active_product_focus("chị là da nhạy cảm, tư vấn loại phù hợp", history) == "tẩy da chết"


def test_recommend_products_keeps_active_product_focus():
    products = [
        _product(1, "Tẩy da chết enzyme dịu nhẹ 80g", 255000),
        _product(2, "Sữa rửa mặt dịu nhẹ cho da nhạy cảm 120ml", 185000),
        _product(3, "Toner cấp ẩm rau má 250ml", 190000),
    ]

    recommended = _recommend_products(products, ["da nhạy cảm"], "chị là da nhạy cảm", "tẩy da chết")

    assert [item.name for item in recommended] == ["Tẩy da chết enzyme dịu nhẹ 80g"]
