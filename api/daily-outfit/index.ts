import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const suggestion = await prisma.dailyOutfitSuggestion.findFirst({
        where: {
          user_id: user.id,
          suggestion_date: { gte: startOfDay, lt: endOfDay },
        },
      });
      return res.status(200).json(suggestion ?? null);
    }

    if (req.method === 'POST') {
      const { outfit_data, ai_reasoning, occasion, style_preference, weather_context } = req.body;
      const suggestion = await prisma.dailyOutfitSuggestion.create({
        data: {
          user_id: user.id,
          outfit_data,
          ai_reasoning,
          occasion,
          style_preference,
          weather_context,
          suggestion_date: new Date(),
        },
      });
      return res.status(201).json(suggestion);
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id query param is required' });

      const { user_feedback, was_worn } = req.body;
      const updated = await prisma.dailyOutfitSuggestion.update({
        where: { id: id as string },
        data: { user_feedback, was_worn },
      });
      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
