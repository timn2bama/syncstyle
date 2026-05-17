import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireAuth(req);

    if (req.method === 'GET') {
      // Return user record + profile + style preferences
      const [userRecord, profile, stylePreference, subscriber] = await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, name: true, email: true, image: true, createdAt: true },
        }),
        prisma.profile.findUnique({ where: { user_id: user.id } }),
        prisma.userStylePreference.findUnique({ where: { user_id: user.id } }),
        prisma.subscriber.findUnique({ where: { user_id: user.id } }),
      ]);

      if (!userRecord) return res.status(404).json({ error: 'User not found' });

      return res.status(200).json({
        ...userRecord,
        profile,
        style_preference: stylePreference,
        subscription: subscriber,
      });
    }

    if (req.method === 'PUT') {
      const { name, image, display_name, avatar_url, preferences, favorite_colors, disliked_colors, style_keywords } = req.body;

      // Update user base record if name or image changed
      if (name !== undefined || image !== undefined) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(name !== undefined && { name }),
            ...(image !== undefined && { image }),
          },
        });
      }

      // Upsert profile record
      if (display_name !== undefined || avatar_url !== undefined) {
        await prisma.profile.upsert({
          where: { user_id: user.id },
          update: {
            ...(display_name !== undefined && { display_name }),
            ...(avatar_url !== undefined && { avatar_url }),
          },
          create: {
            user_id: user.id,
            display_name: display_name ?? null,
            avatar_url: avatar_url ?? null,
          },
        });
      }

      // Upsert style preferences
      if (preferences !== undefined || favorite_colors !== undefined || disliked_colors !== undefined || style_keywords !== undefined) {
        await prisma.userStylePreference.upsert({
          where: { user_id: user.id },
          update: {
            ...(preferences !== undefined && { preferences }),
            ...(favorite_colors !== undefined && { favorite_colors }),
            ...(disliked_colors !== undefined && { disliked_colors }),
            ...(style_keywords !== undefined && { style_keywords }),
          },
          create: {
            user_id: user.id,
            preferences: preferences ?? {},
            favorite_colors: favorite_colors ?? [],
            disliked_colors: disliked_colors ?? [],
            style_keywords: style_keywords ?? [],
          },
        });
      }

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, image: true, createdAt: true },
      });
      const updatedProfile = await prisma.profile.findUnique({ where: { user_id: user.id } });
      const updatedPrefs = await prisma.userStylePreference.findUnique({ where: { user_id: user.id } });

      return res.status(200).json({
        ...updatedUser,
        profile: updatedProfile,
        style_preference: updatedPrefs,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('[profile]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
