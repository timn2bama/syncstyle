import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const records = await prisma.styleEvolutionTracking.findMany({
        where: { user_id: user.id },
        orderBy: { tracking_date: 'desc' },
        take: 30,
      });
      return res.status(200).json(records);
    }

    if (req.method === 'POST') {
      const {
        tracking_date,
        style_metrics,
        achievements,
        confidence_level,
        mood_tags,
        style_goals,
        insights,
      } = req.body;

      const record = await prisma.styleEvolutionTracking.create({
        data: {
          user_id: user.id,
          tracking_date: tracking_date ? new Date(tracking_date) : new Date(),
          style_metrics: style_metrics ?? undefined,
          achievements: achievements ?? [],
          confidence_level: confidence_level ?? null,
          mood_tags: mood_tags ?? [],
          style_goals: style_goals ?? [],
          insights: insights ?? undefined,
        },
      });
      return res.status(201).json(record);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
