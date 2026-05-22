import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const rentals = await prisma.rentalItem.findMany({
        where: { is_available: true },
        orderBy: { created_at: 'desc' },
      });
      return res.status(200).json(rentals);
    }

    if (req.method === 'POST') {
      const {
        title,
        description,
        daily_rate,
        weekly_rate,
        deposit_amount,
        category,
        size,
        brand,
        photos,
        rental_terms,
        care_instructions,
        wardrobe_item_id,
      } = req.body;

      const rental = await prisma.rentalItem.create({
        data: {
          owner_id: user.id,
          title,
          description,
          daily_rate,
          weekly_rate,
          deposit_amount,
          category,
          size,
          brand,
          photos,
          rental_terms,
          care_instructions,
          wardrobe_item_id,
        },
      });
      return res.status(201).json(rental);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
