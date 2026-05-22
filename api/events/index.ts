import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const events = await prisma.eventOutfitRequest.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
      });
      return res.status(200).json(events);
    }

    if (req.method === 'POST') {
      const {
        event_title,
        event_type,
        event_date,
        dress_code,
        location,
        selected_outfit_id,
        special_requirements,
        weather_requirements,
        suggested_outfits,
        status,
      } = req.body;

      if (!event_title) return res.status(400).json({ error: 'event_title is required' });

      const event = await prisma.eventOutfitRequest.create({
        data: {
          user_id: user.id,
          event_title,
          event_type: event_type ?? null,
          event_date: event_date ? new Date(event_date) : null,
          dress_code: dress_code ?? null,
          location: location ?? null,
          selected_outfit_id: selected_outfit_id ?? null,
          special_requirements: special_requirements ?? null,
          weather_requirements: weather_requirements ?? null,
          suggested_outfits: suggested_outfits ?? undefined,
          status: status ?? 'pending',
        },
      });
      return res.status(201).json(event);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
