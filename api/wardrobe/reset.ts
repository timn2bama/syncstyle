import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth';
import { prisma } from '../lib/prisma';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers['origin'] as string) || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const user = await requireAuth(req);
    const userId = user.id;
    console.info(`[reset-wardrobe] Starting deletion for user: ${userId}`);

    // 1) Collect outfit IDs for the user
    const outfits = await prisma.outfit.findMany({
      where: { userId },
      select: { id: true },
    });

    const outfitIds = outfits.map((o) => o.id);
    let deletedOutfitItems = 0;

    // 2) Delete outfit_items referencing those outfits
    if (outfitIds.length > 0) {
      const result = await prisma.outfitItem.deleteMany({
        where: { outfitId: { in: outfitIds } },
      });
      deletedOutfitItems = result.count;
    }

    // 3) Delete outfits for the user
    const outfitsResult = await prisma.outfit.deleteMany({
      where: { userId },
    });

    // 4) Delete wardrobe_items for the user
    const wardrobeResult = await prisma.wardrobeItem.deleteMany({
      where: { userId },
    });

    // 5) Remove daily outfit suggestions
    await prisma.dailyOutfitSuggestion.deleteMany({
      where: { userId },
    }).catch(() => {
      // Non-critical — ignore if table doesn't exist in schema
    });

    const result = {
      deleted: {
        outfit_items: deletedOutfitItems,
        outfits: outfitsResult.count,
        wardrobe_items: wardrobeResult.count,
      },
    };

    console.info('[reset-wardrobe] Completed:', result);

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[reset-wardrobe] Error:', error);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
