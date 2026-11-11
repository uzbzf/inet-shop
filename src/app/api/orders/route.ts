import { NextResponse } from 'next/server';
import { Order } from '@/types';
import { getDbOrders, insertDbOrder, updateDbOrderStatus } from '@/lib/neon-db';

// In-memory fallback order storage
let memoryOrdersStore: Order[] = [
  {
    id: 'ord-1001',
    orderNumber: 'CF-88219',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    customerName: 'Алишер Усманов',
    customerPhone: '+998 90 123-45-67',
    customerTelegram: '@alisher_tech',
    city: 'Ташкент',
    address: 'Юнусабад, 14-й квартал, дом 22',
    paymentMethod: 'click',
    status: 'confirmed',
    totalUZS: 34500000,
    isBuilderPc: true,
    items: [
      {
        product: {
          id: 'case-lian-li-o11-dynamic-evo',
          name: 'Lian Li O11 Dynamic EVO RGB Black',
          category: 'case',
          brand: 'Lian Li',
          priceUZS: 2900000,
          image: '',
          inStock: true,
          stockCount: 5,
          descriptionRu: '',
          descriptionUz: '',
          specs: {},
        },
        quantity: 1,
      },
      {
        product: {
          id: 'gpu-rtx-4080-super',
          name: 'MSI Gaming X Slim GeForce RTX 4080 Super 16GB',
          category: 'gpu',
          brand: 'MSI',
          priceUZS: 15900000,
          image: '',
          inStock: true,
          stockCount: 5,
          descriptionRu: '',
          descriptionUz: '',
          specs: {},
        },
        quantity: 1,
      },
    ],
  },
];

export async function GET() {
  try {
    const dbOrders = await getDbOrders();
    if (dbOrders !== null) {
      return NextResponse.json({ success: true, orders: dbOrders, source: 'neon_postgres' });
    }
  } catch (err) {
    console.warn('Neon Postgres orders fetch error, falling back to memory store:', err);
  }

  return NextResponse.json({ success: true, orders: memoryOrdersStore, source: 'memory' });
}

export async function POST(req: Request) {
  try {
    const newOrder = (await req.json()) as Order;
    if (!newOrder.orderNumber) {
      newOrder.orderNumber = `CF-${Math.floor(10000 + Math.random() * 90000)}`;
    }
    if (!newOrder.id) {
      newOrder.id = `ord-${Date.now()}`;
    }
    if (!newOrder.createdAt) {
      newOrder.createdAt = new Date().toISOString();
    }
    if (!newOrder.status) {
      newOrder.status = 'pending';
    }

    // Keep memory in sync
    memoryOrdersStore.unshift(newOrder);

    // Save to Neon Postgres
    try {
      await insertDbOrder(newOrder);
    } catch (err) {
      console.warn('Failed to insert order into Neon DB:', err);
    }

    return NextResponse.json({ success: true, order: newOrder });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { orderId, status } = (await req.json()) as { orderId: string; status: Order['status'] };

    // Update memory
    const orderIndex = memoryOrdersStore.findIndex((o) => o.id === orderId);
    if (orderIndex !== -1) {
      memoryOrdersStore[orderIndex].status = status;
    }

    // Update Neon Postgres
    try {
      await updateDbOrderStatus(orderId, status);
    } catch (err) {
      console.warn('Failed to update order status in Neon DB:', err);
    }

    return NextResponse.json({ success: true, orderId, status });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
