import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { requireAuth } from '../lib/auth';
import { prisma } from '../lib/prisma';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.info(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set');
    logStep('Stripe key verified');

    const user = await requireAuth(req);
    if (!user?.email) throw new Error('User not authenticated or email not available');
    logStep('User authenticated', { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep('No customer found, updating unsubscribed state');
      await prisma.subscriber.upsert({
        where: { email: user.email },
        update: {
          stripeCustomerId: null,
          subscribed: false,
          subscriptionTier: null,
          subscriptionEnd: null,
          updatedAt: new Date(),
        },
        create: {
          email: user.email,
          userId: user.id,
          stripeCustomerId: null,
          subscribed: false,
          subscriptionTier: null,
          subscriptionEnd: null,
        },
      });
      return res.status(200).json({ subscribed: false });
    }

    const customerId = customers.data[0].id;
    logStep('Found Stripe customer', { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionTier: string | null = null;
    let subscriptionEnd: Date | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000);
      logStep('Active subscription found', {
        subscriptionId: subscription.id,
        endDate: subscriptionEnd,
      });

      const priceId = subscription.items.data[0].price.id;
      const price = await stripe.prices.retrieve(priceId);
      const amount = price.unit_amount || 0;

      if (amount <= 500) {
        subscriptionTier = 'Premium';
      } else {
        subscriptionTier = 'Enterprise';
      }
      logStep('Determined subscription tier', { priceId, amount, subscriptionTier });
    } else {
      logStep('No active subscription found');
    }

    await prisma.subscriber.upsert({
      where: { email: user.email },
      update: {
        stripeCustomerId: customerId,
        subscribed: hasActiveSub,
        subscriptionTier,
        subscriptionEnd,
        updatedAt: new Date(),
      },
      create: {
        email: user.email,
        userId: user.id,
        stripeCustomerId: customerId,
        subscribed: hasActiveSub,
        subscriptionTier,
        subscriptionEnd,
      },
    });

    logStep('Updated database with subscription info', { subscribed: hasActiveSub, subscriptionTier });
    return res.status(200).json({
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd?.toISOString() || null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in check-subscription', { message: errorMessage });
    return res.status(500).json({ error: errorMessage });
  }
}
