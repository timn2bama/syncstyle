import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const prefs = await prisma.userStylePreference.findUnique({
        where: { user_id: user.id },
      });
      return res.status(200).json(prefs ?? {});
    }

    if (req.method === 'PUT') {
      const { preferences, favorite_colors, disliked_colors, style_keywords } = req.body;
      const prefs = await prisma.userStylePreference.upsert({
        where: { user_id: user.id },
        update: { preferences, favorite_colors, disliked_colors, style_keywords },
        create: {
          user_id: user.id,
          preferences,
          favorite_colors,
          disliked_colors,
          style_keywords,
        },
      });
      return res.status(200).json(prefs);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
