import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    // GET is public — no auth required
    if (req.method === 'GET') {
      const item = await prisma.marketplaceItem.findUnique({
        where: { id },
        include: { wardrobe_item: true },
      });
      if (!item) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(item);
    }

    // All other methods require auth
    const user = await requireAuth(req);

    if (req.method === 'PUT') {
      const existing = await prisma.marketplaceItem.findFirst({
        where: { id, seller_id: user.id },
      });
      if (!existing) return res.status(404).json({ error: 'Not found or access denied' });

      const { title, description, price, condition, category, size, brand, is_available, shipping_included } = req.body;
      const updated = await prisma.marketplaceItem.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(condition !== undefined && { condition }),
          ...(category !== undefined && { category }),
          ...(size !== undefined && { size }),
          ...(brand !== undefined && { brand }),
          ...(is_available !== undefined && { is_available }),
          ...(shipping_included !== undefined && { shipping_included }),
        },
        include: { wardrobe_item: true },
      });
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const deleted = await prisma.marketplaceItem.deleteMany({
        where: { id, seller_id: user.id },
      });
      if (deleted.count === 0) return res.status(404).json({ error: 'Not found or access denied' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('[marketplace/[id]]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
