import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireAuth(req);

    if (req.method === 'GET') {
      const [subscriber, usageTracking] = await Promise.all([
        prisma.subscriber.findUnique({ where: { user_id: user.id } }),
        prisma.usageTracking.findMany({
          where: { user_id: user.id },
          orderBy: { billing_period_start: 'desc' },
          take: 10,
        }),
      ]);

      // Default free tier if no subscriber record exists
      const subscription = subscriber ?? {
        user_id: user.id,
        tier: 'free',
        status: 'active',
        period_start: null,
        period_end: null,
      };

      return res.status(200).json({
        subscription,
        usage: usageTracking,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('[subscriptions]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
