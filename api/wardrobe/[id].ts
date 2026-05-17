import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireAuth(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    if (req.method === 'GET') {
      const item = await prisma.wardrobeItem.findFirst({
        where: { id, user_id: user.id },
      });
      if (!item) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(item);
    }

    if (req.method === 'PUT') {
      const { name, category, brand, color, photo_url, description, wear_count, last_worn, purchase_date } = req.body;
      const item = await prisma.wardrobeItem.updateMany({
        where: { id, user_id: user.id },
        data: {
          ...(name !== undefined && { name }),
          ...(category !== undefined && { category }),
          ...(brand !== undefined && { brand }),
          ...(color !== undefined && { color }),
          ...(photo_url !== undefined && { photo_url }),
          ...(description !== undefined && { description }),
          ...(wear_count !== undefined && { wear_count: parseInt(wear_count) }),
          ...(last_worn !== undefined && { last_worn: last_worn ? new Date(last_worn) : null }),
          ...(purchase_date !== undefined && { purchase_date: purchase_date ? new Date(purchase_date) : null }),
        },
      });
      if (item.count === 0) return res.status(404).json({ error: 'Not found or access denied' });
      const updated = await prisma.wardrobeItem.findUnique({ where: { id } });
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const deleted = await prisma.wardrobeItem.deleteMany({
        where: { id, user_id: user.id },
      });
      if (deleted.count === 0) return res.status(404).json({ error: 'Not found or access denied' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('[wardrobe/[id]]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
