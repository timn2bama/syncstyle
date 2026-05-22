import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const logs = await prisma.outfitWearLog.findMany({
        where: { user_id: user.id },
        orderBy: { worn_date: 'desc' },
        take: 50,
      });
      return res.status(200).json(logs);
    }

    if (req.method === 'POST') {
      const { outfit_id, worn_date, occasion, items_worn, comfort_rating, notes } = req.body;
      const log = await prisma.outfitWearLog.create({
        data: {
          user_id: user.id,
          outfit_id,
          worn_date,
          occasion,
          items_worn: items_worn ?? [],
          comfort_rating,
          notes,
        },
      });
      return res.status(201).json(log);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
