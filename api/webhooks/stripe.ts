import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { prisma } from '../lib/prisma';

export const config = { api: { bodyParser: false } };

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.info(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers['origin'] as string) || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, stripe-signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    logStep('Webhook received');

    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      logStep('ERROR: Missing stripe-signature header');
      return res.status(400).send('Missing stripe-signature header');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logStep('ERROR: Missing STRIPE_WEBHOOK_SECRET');
      return res.status(500).send('Webhook secret not configured');
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    const body = await buffer(req);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      logStep('Webhook signature verified', { eventType: event.type });
    } catch (err) {
      logStep('ERROR: Webhook signature verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(400).send('Invalid signature');
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep('Processing subscription event', {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          status: subscription.status,
        });

        const customer = await stripe.customers.retrieve(subscription.customer as string);
        const customerEmail = (customer as Stripe.Customer).email;

        if (!customerEmail) {
          logStep('WARNING: No email found for customer', { customerId: subscription.customer });
          break;
        }

        let subscriptionTier = 'Basic';
        if (subscription.items.data.length > 0) {
          const priceId = subscription.items.data[0].price.id;
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount || 0;

          if (amount <= 999) {
            subscriptionTier = 'Basic';
          } else if (amount <= 1999) {
            subscriptionTier = 'Premium';
          } else {
            subscriptionTier = 'Enterprise';
          }
        }

        await prisma.subscriber.upsert({
          where: { email: customerEmail },
          update: {
            stripeCustomerId: subscription.customer as string,
            subscribed: subscription.status === 'active',
            subscriptionTier: subscription.status === 'active' ? subscriptionTier : null,
            subscriptionEnd:
              subscription.status === 'active'
                ? new Date(subscription.current_period_end * 1000)
                : null,
            updatedAt: new Date(),
          },
          create: {
            email: customerEmail,
            stripeCustomerId: subscription.customer as string,
            subscribed: subscription.status === 'active',
            subscriptionTier: subscription.status === 'active' ? subscriptionTier : null,
            subscriptionEnd:
              subscription.status === 'active'
                ? new Date(subscription.current_period_end * 1000)
                : null,
          },
        });

        logStep('Successfully updated subscription', {
          email: customerEmail,
          subscribed: subscription.status === 'active',
          tier: subscriptionTier,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep('Processing subscription deletion', { subscriptionId: subscription.id });

        const customer = await stripe.customers.retrieve(subscription.customer as string);
        const customerEmail = (customer as Stripe.Customer).email;

        if (!customerEmail) {
          logStep('WARNING: No email found for customer', { customerId: subscription.customer });
          break;
        }

        await prisma.subscriber.upsert({
          where: { email: customerEmail },
          update: {
            stripeCustomerId: subscription.customer as string,
            subscribed: false,
            subscriptionTier: null,
            subscriptionEnd: null,
            updatedAt: new Date(),
          },
          create: {
            email: customerEmail,
            stripeCustomerId: subscription.customer as string,
            subscribed: false,
            subscriptionTier: null,
            subscriptionEnd: null,
          },
        });

        logStep('Successfully cancelled subscription', { email: customerEmail });
        break;
      }

      default:
        logStep('Unhandled event type', { eventType: event.type });
    }

    return res.status(200).send('Webhook processed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR: Webhook processing failed', { error: errorMessage });
    return res.status(500).send('Webhook processing failed');
  }
}
