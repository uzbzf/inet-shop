import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { Order, Product, Game } from '@/types';
import { INITIAL_PRODUCTS } from '@/data/products';
import { INITIAL_GAMES } from '@/data/games';

let sqlClient: NeonQueryFunction<false, false> | null = null;
let isInitialized = false;

export function getDb(): NeonQueryFunction<false, false> | null {
  if (sqlClient) return sqlClient;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return null;
  }

  sqlClient = neon(dbUrl);
  return sqlClient;
}

/**
 * Ensures required database tables exist in Neon Postgres
 */
export async function initDb() {
  if (isInitialized) return;
  const sql = getDb();
  if (!sql) return;

  try {
    // 1. Orders table
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        customer_telegram VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        items JSONB NOT NULL,
        total_uzs BIGINT NOT NULL,
        notes TEXT,
        is_builder_pc BOOLEAN DEFAULT FALSE,
        builder_specs JSONB,
        receipt_image_url TEXT
      );
    `;

    // 2. Products table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        price_uzs BIGINT NOT NULL,
        image TEXT,
        in_stock BOOLEAN DEFAULT TRUE,
        stock_count INT DEFAULT 10,
        description_ru TEXT,
        description_uz TEXT,
        specs JSONB,
        featured BOOLEAN DEFAULT FALSE,
        model_3d TEXT
      );
    `;

    // 3. Games table
    await sql`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        genre VARCHAR(100) NOT NULL,
        release_year INT NOT NULL,
        cover_image TEXT,
        cpu_weight NUMERIC(3, 2) DEFAULT 0.7,
        gpu_weight NUMERIC(3, 2) DEFAULT 0.9,
        ram_min_gb INT DEFAULT 16,
        vram_min_gb INT DEFAULT 8,
        base_difficulty NUMERIC(4, 2) DEFAULT 7.0,
        optimal_fps_target INT DEFAULT 60
      );
    `;

    // Seed products if table is empty
    const countProductsResult = await sql`SELECT COUNT(*)::int as count FROM products;`;
    if (countProductsResult[0]?.count === 0 && INITIAL_PRODUCTS.length > 0) {
      for (const p of INITIAL_PRODUCTS) {
        await sql`
          INSERT INTO products (
            id, name, category, brand, price_uzs, image, in_stock, stock_count,
            description_ru, description_uz, specs, featured, model_3d
          ) VALUES (
            ${p.id}, ${p.name}, ${p.category}, ${p.brand}, ${p.priceUZS}, ${p.image},
            ${p.inStock}, ${p.stockCount}, ${p.descriptionRu}, ${p.descriptionUz},
            ${JSON.stringify(p.specs)}, ${Boolean(p.featured)}, ${p.model3D || null}
          ) ON CONFLICT (id) DO NOTHING;
        `;
      }
    }

    // Seed games if table is empty
    const countGamesResult = await sql`SELECT COUNT(*)::int as count FROM games;`;
    if (countGamesResult[0]?.count === 0 && INITIAL_GAMES.length > 0) {
      for (const g of INITIAL_GAMES) {
        await sql`
          INSERT INTO games (
            id, title, genre, release_year, cover_image, cpu_weight, gpu_weight,
            ram_min_gb, vram_min_gb, base_difficulty, optimal_fps_target
          ) VALUES (
            ${g.id}, ${g.title}, ${g.genre}, ${g.releaseYear}, ${g.coverImage},
            ${g.cpuWeight}, ${g.gpuWeight}, ${g.ramMinGB}, ${g.vramMinGB},
            ${g.baseDifficulty}, ${g.optimalFpsTarget}
          ) ON CONFLICT (id) DO NOTHING;
        `;
      }
    }

    isInitialized = true;
  } catch (err) {
    console.error('Neon DB schema initialization error:', err);
  }
}

// ---------------- ORDERS OPERATIONS ---------------- //
export async function getDbOrders(): Promise<Order[] | null> {
  const sql = getDb();
  if (!sql) return null;
  await initDb();

  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC;`;
  return rows.map((r: any): Order => ({
    id: r.id,
    orderNumber: r.order_number,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerTelegram: r.customer_telegram || '',
    city: r.city,
    address: r.address,
    paymentMethod: r.payment_method,
    status: r.status,
    items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
    totalUZS: Number(r.total_uzs),
    notes: r.notes || undefined,
    isBuilderPc: Boolean(r.is_builder_pc),
    builderSpecs: r.builder_specs ? (typeof r.builder_specs === 'string' ? JSON.parse(r.builder_specs) : r.builder_specs) : undefined,
    receiptImageUrl: r.receipt_image_url || undefined,
  }));
}

export async function insertDbOrder(order: Order): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  await initDb();

  await sql`
    INSERT INTO orders (
      id, order_number, created_at, customer_name, customer_phone, customer_telegram,
      city, address, payment_method, status, items, total_uzs, notes, is_builder_pc,
      builder_specs, receipt_image_url
    ) VALUES (
      ${order.id},
      ${order.orderNumber},
      ${order.createdAt || new Date().toISOString()},
      ${order.customerName},
      ${order.customerPhone},
      ${order.customerTelegram || null},
      ${order.city},
      ${order.address},
      ${order.paymentMethod},
      ${order.status || 'pending'},
      ${JSON.stringify(order.items)},
      ${order.totalUZS},
      ${order.notes || null},
      ${Boolean(order.isBuilderPc)},
      ${order.builderSpecs ? JSON.stringify(order.builderSpecs) : null},
      ${order.receiptImageUrl || null}
    )
    ON CONFLICT (id) DO UPDATE SET
      receipt_image_url = EXCLUDED.receipt_image_url,
      status = EXCLUDED.status;
  `;
  return true;
}

export async function updateDbOrderStatus(orderId: string, status: Order['status']): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  await initDb();

  const res = await sql`
    UPDATE orders SET status = ${status} WHERE id = ${orderId};
  `;
  return true;
}

// ---------------- PRODUCTS OPERATIONS ---------------- //
export async function getDbProducts(): Promise<Product[] | null> {
  const sql = getDb();
  if (!sql) return null;
  await initDb();

  const rows = await sql`SELECT * FROM products ORDER BY id ASC;`;
  return rows.map((r: any): Product => ({
    id: r.id,
    name: r.name,
    category: r.category,
    brand: r.brand,
    priceUZS: Number(r.price_uzs),
    image: r.image || '',
    inStock: Boolean(r.in_stock),
    stockCount: Number(r.stock_count),
    descriptionRu: r.description_ru || '',
    descriptionUz: r.description_uz || '',
    specs: typeof r.specs === 'string' ? JSON.parse(r.specs) : (r.specs || {}),
    featured: Boolean(r.featured),
    model3D: r.model_3d || undefined,
  }));
}

export async function insertDbProduct(product: Product): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  await initDb();

  await sql`
    INSERT INTO products (
      id, name, category, brand, price_uzs, image, in_stock, stock_count,
      description_ru, description_uz, specs, featured, model_3d
    ) VALUES (
      ${product.id},
      ${product.name},
      ${product.category},
      ${product.brand},
      ${product.priceUZS},
      ${product.image},
      ${product.inStock},
      ${product.stockCount},
      ${product.descriptionRu},
      ${product.descriptionUz},
      ${JSON.stringify(product.specs || {})},
      ${Boolean(product.featured)},
      ${product.model3D || null}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      brand = EXCLUDED.brand,
      price_uzs = EXCLUDED.price_uzs,
      image = EXCLUDED.image,
      in_stock = EXCLUDED.in_stock,
      stock_count = EXCLUDED.stock_count,
      description_ru = EXCLUDED.description_ru,
      description_uz = EXCLUDED.description_uz,
      specs = EXCLUDED.specs,
      featured = EXCLUDED.featured,
      model_3d = EXCLUDED.model_3d;
  `;
  return true;
}

export async function deleteDbProduct(id: string): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  await initDb();

  await sql`DELETE FROM products WHERE id = ${id};`;
  return true;
}

// ---------------- GAMES OPERATIONS ---------------- //
export async function getDbGames(): Promise<Game[] | null> {
  const sql = getDb();
  if (!sql) return null;
  await initDb();

  const rows = await sql`SELECT * FROM games ORDER BY id ASC;`;
  return rows.map((r: any): Game => ({
    id: r.id,
    title: r.title,
    genre: r.genre,
    releaseYear: Number(r.release_year),
    coverImage: r.cover_image || '',
    cpuWeight: Number(r.cpu_weight),
    gpuWeight: Number(r.gpu_weight),
    ramMinGB: Number(r.ram_min_gb),
    vramMinGB: Number(r.vram_min_gb),
    baseDifficulty: Number(r.base_difficulty),
    optimalFpsTarget: Number(r.optimal_fps_target),
  }));
}

export async function insertDbGame(game: Game): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  await initDb();

  await sql`
    INSERT INTO games (
      id, title, genre, release_year, cover_image, cpu_weight, gpu_weight,
      ram_min_gb, vram_min_gb, base_difficulty, optimal_fps_target
    ) VALUES (
      ${game.id},
      ${game.title},
      ${game.genre},
      ${game.releaseYear},
      ${game.coverImage},
      ${game.cpuWeight},
      ${game.gpuWeight},
      ${game.ramMinGB},
      ${game.vramMinGB},
      ${game.baseDifficulty},
      ${game.optimalFpsTarget}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      genre = EXCLUDED.genre,
      release_year = EXCLUDED.release_year,
      cover_image = EXCLUDED.cover_image,
      cpu_weight = EXCLUDED.cpu_weight,
      gpu_weight = EXCLUDED.gpu_weight,
      ram_min_gb = EXCLUDED.ram_min_gb,
      vram_min_gb = EXCLUDED.vram_min_gb,
      base_difficulty = EXCLUDED.base_difficulty,
      optimal_fps_target = EXCLUDED.optimal_fps_target;
  `;
  return true;
}

export async function deleteDbGame(id: string): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  await initDb();

  await sql`DELETE FROM games WHERE id = ${id};`;
  return true;
}
