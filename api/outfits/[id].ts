import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireAuth(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Outfit ID is required' });
    }

    if (req.method === 'GET') {
      const outfit = await prisma.outfit.findFirst({
        where: { id, user_id: user.id },
        include: { items: { include: { wardrobe_item: true } }, wear_logs: true },
      });
      if (!outfit) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(outfit);
    }

    if (req.method === 'PUT') {
      const { name, description, occasion, season, is_public, items } = req.body;

      // Verify ownership
      const existing = await prisma.outfit.findFirst({ where: { id, user_id: user.id } });
      if (!existing) return res.status(404).json({ error: 'Not found or access denied' });

      const updated = await prisma.outfit.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(occasion !== undefined && { occasion }),
          ...(season !== undefined && { season }),
          ...(is_public !== undefined && { is_public }),
          // If items array provided, replace all outfit items
          ...(Array.isArray(items) && {
            items: {
              deleteMany: {},
              create: items.map((itemId: string) => ({
                wardrobe_item: { connect: { id: itemId } },
              })),
            },
          }),
        },
        include: { items: { include: { wardrobe_item: true } } },
      });
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const deleted = await prisma.outfit.deleteMany({
        where: { id, user_id: user.id },
      });
      if (deleted.count === 0) return res.status(404).json({ error: 'Not found or access denied' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('[outfits/[id]]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
