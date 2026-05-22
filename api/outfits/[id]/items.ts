import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../lib/prisma';
import { verifyUser } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id: outfitId } = req.query;
  if (!outfitId || typeof outfitId !== 'string') {
    return res.status(400).json({ error: 'Outfit ID is required' });
  }

  try {
    // Verify outfit belongs to user
    const outfit = await prisma.outfit.findFirst({
      where: { id: outfitId, user_id: user.id },
    });
    if (!outfit) return res.status(404).json({ error: 'Outfit not found' });

    if (req.method === 'POST') {
      const { wardrobe_item_id } = req.body;
      if (!wardrobe_item_id) {
        return res.status(400).json({ error: 'wardrobe_item_id is required' });
      }

      const item = await prisma.outfitItem.create({
        data: { outfit_id: outfitId, wardrobe_item_id },
        include: { wardrobe_item: true },
      });
      return res.status(201).json(item);
    }

    if (req.method === 'DELETE') {
      const { wardrobe_item_id } = req.body;
      if (!wardrobe_item_id) {
        return res.status(400).json({ error: 'wardrobe_item_id is required' });
      }
      await prisma.outfitItem.deleteMany({
        where: { outfit_id: outfitId, wardrobe_item_id },
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[outfits/[id]/items]', err);
    return res.status(500).json({ error: err.message });
  }
}
