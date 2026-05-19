from app.agent.parser import parse_message


def test_parse_order_with_phone_and_address():
    plan = parse_message("Đặt cho chị 2 serum vitamin C, giao tới 12 Nguyễn Trãi, SĐT 0901234567", customer_name="Nguyễn Thảo")

    assert plan.intent == "buy_product"
    assert plan.slots.quantity == 2
    assert plan.slots.customer_phone == "0901234567"
    assert plan.slots.shipping_address == "12 Nguyễn Trãi"
    assert "serum" in plan.slots.product_query


def test_parse_stock_question():
    plan = parse_message("Shop còn kem dưỡng Johnson xanh không?")

    assert plan.intent == "ask_stock"
    assert plan.slots.quantity == 1
    assert "kem" in plan.slots.product_query
