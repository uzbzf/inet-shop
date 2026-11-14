import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { updateDbOrderStatus } from '@/lib/neon-db';
import { getTelegramCredentials } from '@/lib/telegram';

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: any;

  try {
    const rawBody = await req.text();

    if (webhookSecret) {
      const signature = req.headers.get('stripe-signature') || '';
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      event = JSON.parse(rawBody);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid payload';
    console.error('Stripe webhook verification error:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Handle event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId || session.client_reference_id;
    const orderNumber = session.metadata?.orderNumber || 'N/A';
    const customerName = session.metadata?.customerName || 'Покупатель';
    const amountTotal = session.amount_total ? (session.amount_total / 100).toFixed(2) : '0';
    const currency = (session.currency || 'USD').toUpperCase();

    // 1. Update order status in Neon DB
    if (orderId) {
      try {
        await updateDbOrderStatus(orderId, 'confirmed');
      } catch (dbErr) {
        console.warn('Failed to update order status in DB:', dbErr);
      }
    }

    // 2. Notify Telegram bot
    try {
      const { token, chatId } = getTelegramCredentials();
      if (token && chatId) {
        const text = `
🟢 <b>УСПЕШНАЯ ОПЛАТА С КАРТЫ (STRIPE)</b>
───────────────
📦 Заказ: <b>№${orderNumber}</b>
👤 Клиент: ${customerName}
💰 Сумма: <b>${amountTotal} ${currency}</b>
💳 Метод: Stripe (Visa / Mastercard)
Статус: <b>Оплачено онлайн ✓</b>
───────────────
<i>Заказ передан на комплектацию и сборку.</i>
`.trim();

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
          }),
        });
      }
    } catch (tgErr) {
      console.warn('Failed to dispatch telegram notification for stripe event:', tgErr);
    }
  }

  return NextResponse.json({ received: true });
}
