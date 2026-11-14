import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { updateDbOrderStatus } from '@/lib/neon-db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const orderId = searchParams.get('orderId');

    if (!sessionId) {
      return NextResponse.json({ success: false, message: 'Missing sessionId' }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ success: false, message: 'Stripe not initialized' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPaid = session.payment_status === 'paid';
    const targetOrderId = orderId || session.client_reference_id || session.metadata?.orderId;

    if (isPaid && targetOrderId) {
      try {
        await updateDbOrderStatus(targetOrderId, 'confirmed');
      } catch (e) {
        console.warn('Failed to update DB order status:', e);
      }
    }

    return NextResponse.json({
      success: true,
      paid: isPaid,
      status: session.status,
      customerName: session.customer_details?.name || session.metadata?.customerName,
      amountTotal: session.amount_total,
      currency: session.currency,
      orderNumber: session.metadata?.orderNumber,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
