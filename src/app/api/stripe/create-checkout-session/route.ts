import { NextResponse } from 'next/server';
import { getStripe, getStripeSecretKey } from '@/lib/stripe';
import { Order } from '@/types';

export async function POST(req: Request) {
  try {
    const { order, origin } = (await req.json()) as { order: Order; origin?: string };

    if (!order || !order.items || order.items.length === 0) {
      return NextResponse.json({ success: false, message: 'Заказ пуст' }, { status: 400 });
    }

    const secretKey = getStripeSecretKey();
    if (!secretKey) {
      return NextResponse.json({
        success: false,
        requiresKey: true,
        message:
          'Ключ STRIPE_SECRET_KEY не настроен в .env.local! Добавьте ваш секретный ключ Stripe (начинается с sk_test_... или sk_live_...).',
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ success: false, message: 'Не удалось инициализировать Stripe SDK' }, { status: 500 });
    }

    const baseOrigin =
      origin ||
      req.headers.get('origin') ||
      req.headers.get('referer')?.replace(/\/$/, '') ||
      'http://localhost:3000';

    const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
    // Currency conversion rate: 1 USD ~ 12,800 UZS
    const UZS_PER_USD = 12800;

    const lineItems = order.items.map((item) => {
      let unitAmount: number;

      if (currency === 'uzs') {
        // Stripe UZS has 2 decimals (tiyin)
        unitAmount = Math.round(item.product.priceUZS * 100);
      } else {
        // Convert UZS to USD cents
        const priceUSD = item.product.priceUZS / UZS_PER_USD;
        unitAmount = Math.max(50, Math.round(priceUSD * 100)); // Minimum 50 cents
      }

      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.product.name,
            description: `${item.product.brand} - ${item.product.category.toUpperCase()}`,
            images: item.product.image && item.product.image.startsWith('http') ? [item.product.image] : [],
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      success_url: `${baseOrigin}/?stripe=success&orderId=${order.id}&orderNumber=${order.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseOrigin}/?stripe=cancel&orderId=${order.id}`,
      client_reference_id: order.id,
      customer_email: order.customerTelegram?.includes('@') && !order.customerTelegram.includes('t.me')
        ? undefined
        : undefined,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        currency: currency,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown Stripe error';
    console.error('Stripe Checkout Session error:', error);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
