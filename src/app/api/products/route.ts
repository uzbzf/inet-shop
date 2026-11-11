import { NextResponse } from 'next/server';
import { INITIAL_PRODUCTS } from '@/data/products';
import { Product } from '@/types';
import { getDbProducts, insertDbProduct, deleteDbProduct } from '@/lib/neon-db';

let memoryProductsStore: Product[] = [...INITIAL_PRODUCTS];

export async function GET() {
  try {
    const dbProducts = await getDbProducts();
    if (dbProducts !== null && dbProducts.length > 0) {
      return NextResponse.json({ success: true, products: dbProducts, source: 'neon_postgres' });
    }
  } catch (err) {
    console.warn('Neon Postgres products fetch error, falling back to memory store:', err);
  }

  return NextResponse.json({ success: true, products: memoryProductsStore, source: 'memory' });
}

export async function POST(req: Request) {
  try {
    const product = (await req.json()) as Product;
    if (!product.id) {
      product.id = `prod-${Date.now()}`;
    }
    memoryProductsStore.unshift(product);

    try {
      await insertDbProduct(product);
    } catch (err) {
      console.warn('Failed to insert product into Neon DB:', err);
    }

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const product = (await req.json()) as Product;
    const index = memoryProductsStore.findIndex((p) => p.id === product.id);
    if (index !== -1) {
      memoryProductsStore[index] = product;
    }

    try {
      await insertDbProduct(product);
    } catch (err) {
      console.warn('Failed to update product in Neon DB:', err);
    }

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing product ID' }, { status: 400 });
    }
    memoryProductsStore = memoryProductsStore.filter((p) => p.id !== id);

    try {
      await deleteDbProduct(id);
    } catch (err) {
      console.warn('Failed to delete product from Neon DB:', err);
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
