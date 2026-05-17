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
  console.info(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
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
      throw new Error('No Stripe customer found for this user');
    }
    const customerId = customers.data[0].id;
    logStep('Found Stripe customer', { customerId });

    const requestOrigin = origin || 'http://localhost:3000';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${requestOrigin}/subscription`,
    });
    logStep('Customer portal session created', {
      sessionId: portalSession.id,
      url: portalSession.url,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in customer-portal', { message: errorMessage });
    return res.status(500).json({ error: errorMessage });
  }
}
