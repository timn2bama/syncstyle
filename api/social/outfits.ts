import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const { outfit_id } = req.query;
      if (!outfit_id) return res.status(400).json({ error: 'outfit_id is required' });

      const id = outfit_id as string;

      const [likesCount, userLike, ratingsAgg, comments] = await Promise.all([
        prisma.outfitLike.count({ where: { outfit_id: id } }),
        prisma.outfitLike.findUnique({
          where: { user_id_outfit_id: { user_id: user.id, outfit_id: id } },
        }),
        prisma.outfitRating.aggregate({
          where: { outfit_id: id },
          _avg: { rating: true },
          _count: true,
        }),
        prisma.outfitComment.findMany({
          where: { outfit_id: id },
          orderBy: { created_at: 'desc' },
        }),
      ]);

      const userRating = await prisma.outfitRating.findUnique({
        where: { user_id_outfit_id: { user_id: user.id, outfit_id: id } },
      });

      return res.status(200).json({
        likes_count: likesCount,
        user_liked: !!userLike,
        avg_rating: ratingsAgg._avg.rating,
        ratings_count: ratingsAgg._count,
        user_rating: userRating?.rating ?? null,
        comments,
      });
    }

    if (req.method === 'POST') {
      const { action, outfit_id, rating, content } = req.body;

      if (!outfit_id) return res.status(400).json({ error: 'outfit_id is required' });
      if (!action) return res.status(400).json({ error: 'action is required' });

      if (action === 'like') {
        const like = await prisma.outfitLike.upsert({
          where: { user_id_outfit_id: { user_id: user.id, outfit_id } },
          create: { user_id: user.id, outfit_id },
          update: {},
        });
        return res.status(200).json(like);
      }

      if (action === 'unlike') {
        await prisma.outfitLike.deleteMany({
          where: { user_id: user.id, outfit_id },
        });
        return res.status(200).json({ success: true });
      }

      if (action === 'rate') {
        if (rating === undefined || rating === null) {
          return res.status(400).json({ error: 'rating is required for rate action' });
        }
        const outfitRating = await prisma.outfitRating.upsert({
          where: { user_id_outfit_id: { user_id: user.id, outfit_id } },
          create: { user_id: user.id, outfit_id, rating },
          update: { rating },
        });
        return res.status(200).json(outfitRating);
      }

      if (action === 'comment') {
        if (!content) return res.status(400).json({ error: 'content is required for comment action' });
        const comment = await prisma.outfitComment.create({
          data: { user_id: user.id, outfit_id, content },
        });
        return res.status(201).json(comment);
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
