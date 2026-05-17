import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { requireAuth } from '../lib/auth';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.info(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers['origin'] as string) || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    logStep('Function started');

    const user = await requireAuth(req);
    if (!user?.email) throw new Error('User not authenticated or email not available');
    logStep('User authenticated', { userId: user.id, email: user.email });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep('Found existing customer', { customerId });
    }

    const requestOrigin = origin || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Premium Wardrobe Subscription' },
            unit_amount: 600, // $6.00 in cents
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${requestOrigin}/subscription?success=true`,
      cancel_url: `${requestOrigin}/subscription?canceled=true`,
    });

    logStep('Checkout session created', { sessionId: session.id });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in create-checkout', { message: errorMessage });
    return res.status(500).json({ error: errorMessage });
  }
}
