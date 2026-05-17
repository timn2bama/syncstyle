import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireAuth(req);

    if (req.method === 'GET') {
      const [items, outfits, wardrobeAnalytics] = await Promise.all([
        prisma.wardrobeItem.findMany({
          where: { user_id: user.id },
          orderBy: { wear_count: 'desc' },
        }),
        prisma.outfit.findMany({
          where: { user_id: user.id },
        }),
        prisma.wardrobeAnalytics.findMany({
          where: { user_id: user.id },
          include: { wardrobe_item: { select: { name: true, category: true } } },
        }),
      ]);

      // Category distribution
      const categoryDistribution = items.reduce((acc: Record<string, number>, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {});

      // Most worn items (top 10)
      const mostWornItems = items
        .filter((item) => item.wear_count > 0)
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          wear_count: item.wear_count,
          photo_url: item.photo_url,
        }));

      // Cost per wear from WardrobeAnalytics
      const costPerWearItems = wardrobeAnalytics
        .filter((a) => a.cost_per_wear !== null)
        .sort((a, b) => (a.cost_per_wear ?? 0) - (b.cost_per_wear ?? 0))
        .slice(0, 10)
        .map((a) => ({
          id: a.wardrobe_item_id,
          name: a.wardrobe_item.name,
          category: a.wardrobe_item.category,
          wear_count: a.wear_count,
          total_cost: a.total_cost,
          cost_per_wear: a.cost_per_wear,
        }));

      // Items never worn (deadstock)
      const neverWornItems = items.filter((item) => item.wear_count === 0);

      // Monthly growth — group by creation month
      const monthlyGrowth: Record<string, number> = {};
      for (const item of items) {
        const monthKey = item.created_at.toISOString().slice(0, 7); // YYYY-MM
        monthlyGrowth[monthKey] = (monthlyGrowth[monthKey] || 0) + 1;
      }
      const growth = Object.entries(monthlyGrowth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));

      return res.status(200).json({
        totalItems: items.length,
        totalOutfits: outfits.length,
        neverWornCount: neverWornItems.length,
        categoryDistribution: Object.entries(categoryDistribution).map(([name, value]) => ({ name, value })),
        mostWornItems,
        costPerWearItems,
        growth,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('[analytics]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
