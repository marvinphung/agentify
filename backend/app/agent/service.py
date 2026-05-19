from sqlalchemy.orm import Session

from app.agent.llm import plan_with_llm
from app.agent.schemas import ToolResult
from app.agent.tools import check_stock, create_draft_order, search_products
from app.models import AgentAction, Conversation, Message, Order


async def handle_customer_message(db: Session, *, conversation: Conversation, customer_id: int, customer_name: str, customer_phone: str | None, message: str) -> tuple[str, list[ToolResult], Order | None]:
    plan = await plan_with_llm(message, customer_name=customer_name, customer_phone=customer_phone)
    if customer_phone and not plan.slots.customer_phone:
        plan.slots.customer_phone = customer_phone
    if customer_name and not plan.slots.customer_name:
        plan.slots.customer_name = customer_name

    actions: list[ToolResult] = [ToolResult(type="intent_detected", status="success", summary=f"Ý định: {plan.intent} ({plan.source}).", data=plan.model_dump())]
    order: Order | None = None

    if "ask_clarification" in plan.tool_plan and not plan.slots.product_query:
        reply = plan.reply_if_missing or "Dạ chị muốn đặt sản phẩm nào ạ?"
        actions.append(ToolResult(type="reply", status="success", summary=reply))
        _persist_actions(db, conversation.id, actions)
        _persist_ai_message(db, conversation.id, reply)
        return reply, actions, None

    product_result = search_products(db, plan.slots.product_query)
    actions.append(product_result)
    stock_result = check_stock(product_result, plan.slots.quantity)
    actions.append(stock_result)

    if plan.intent == "buy_product" or "create_draft_order" in plan.tool_plan:
        order_result, order = create_draft_order(db, conversation_id=conversation.id, customer_id=customer_id, plan=plan, product_result=product_result, stock_result=stock_result)
        actions.append(order_result)
        if order_result.status == "success":
            conversation.status = "order_created"
            reply = _order_reply(product_result, plan.slots.quantity, order)
        else:
            conversation.status = "open"
            reply = _missing_info_reply(plan, order_result)
    else:
        reply = _stock_reply(product_result, stock_result)

    actions.append(ToolResult(type="reply", status="success", summary=reply))
    _persist_actions(db, conversation.id, actions)
    _persist_ai_message(db, conversation.id, reply)
    return reply, actions, order


def _stock_reply(product_result: ToolResult, stock_result: ToolResult) -> str:
    if product_result.status != "success":
        return f"Dạ em chưa tìm thấy sản phẩm phù hợp. {product_result.summary}"
    return f"Dạ {stock_result.summary}"


def _missing_info_reply(plan, order_result: ToolResult) -> str:
    if not plan.slots.customer_phone:
        return "Dạ sản phẩm còn hàng. Chị cho em xin số điện thoại để em lên đơn nhé."
    if not plan.slots.shipping_address:
        return "Dạ sản phẩm còn hàng. Chị cho em xin địa chỉ giao hàng để em lên đơn nhé."
    return f"Dạ em chưa thể tạo đơn. {order_result.summary}"


def _order_reply(product_result: ToolResult, quantity: int, order: Order | None) -> str:
    name = product_result.data.get("name", "sản phẩm")
    order_code = f"#{order.id}" if order else ""
    total = int(order.total) if order else 0
    return f"Dạ em đã tạo đơn nháp {order_code}: {quantity} {name}, tổng tạm tính {total:,}đ. Nhân viên sẽ xác nhận trước khi giao."


def _persist_actions(db: Session, conversation_id: int, actions: list[ToolResult]) -> None:
    for action in actions:
        db.add(AgentAction(conversation_id=conversation_id, action_type=action.type, status=action.status, summary=action.summary, raw_json=action.data))


def _persist_ai_message(db: Session, conversation_id: int, reply: str) -> None:
    db.add(Message(conversation_id=conversation_id, sender="ai", content=reply))
