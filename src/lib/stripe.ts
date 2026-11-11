import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';

let stripeClient: Stripe | null = null;

export function getStripeSecretKey(): string {
  let key = process.env.STRIPE_SECRET_KEY || '';

  if (!key) {
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/STRIPE_SECRET_KEY=["']?([^"'\r\n]+)["']?/);
        if (match && match[1]) {
          key = match[1].trim();
          process.env.STRIPE_SECRET_KEY = key;
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return key;
}

export function getStripe(): Stripe | null {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-03-25.acacia' as any,
    });
  }

  return stripeClient;
}
