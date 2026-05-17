import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth';
import { prisma } from '../lib/prisma';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

const categoryMultipliers: Record<string, { manufacturing: number; transportation: number; usage: number; disposal: number }> = {
  tops:        { manufacturing: 8,  transportation: 2, usage: 0.5, disposal: 1 },
  bottoms:     { manufacturing: 12, transportation: 3, usage: 0.8, disposal: 2 },
  dresses:     { manufacturing: 15, transportation: 4, usage: 1.2, disposal: 2.5 },
  shoes:       { manufacturing: 20, transportation: 5, usage: 0.3, disposal: 3 },
  accessories: { manufacturing: 5,  transportation: 1, usage: 0.1, disposal: 0.5 },
  outerwear:   { manufacturing: 25, transportation: 6, usage: 1.5, disposal: 4 },
};

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

    const { user_id } = req.body || {};
    const targetUserId = user_id || user.id;

    // Get user's wardrobe items
    const wardrobeItems = await prisma.wardrobeItem.findMany({
      where: { userId: targetUserId },
    });

    const carbonFootprintData: any[] = [];

    for (const item of wardrobeItems) {
      const multiplier = categoryMultipliers[item.category] || categoryMultipliers['tops'];

      carbonFootprintData.push({
        wardrobeItemId: item.id,
        userId: targetUserId,
        manufacturingImpact: multiplier.manufacturing,
        transportationImpact: multiplier.transportation,
        usageImpact: multiplier.usage * ((item as any).wearCount || 1),
        disposalImpact: multiplier.disposal,
      });
    }

    // Upsert carbon footprint data for each item
    for (const data of carbonFootprintData) {
      await prisma.carbonFootprintItem.upsert({
        where: { wardrobeItemId: data.wardrobeItemId },
        update: {
          manufacturingImpact: data.manufacturingImpact,
          transportationImpact: data.transportationImpact,
          usageImpact: data.usageImpact,
          disposalImpact: data.disposalImpact,
        },
        create: data,
      });
    }

    // Calculate total sustainability metrics
    const totalFootprint = carbonFootprintData.reduce(
      (sum, item) =>
        sum +
        item.manufacturingImpact +
        item.transportationImpact +
        item.usageImpact +
        item.disposalImpact,
      0
    );

    const today = new Date().toISOString().split('T')[0];
    await prisma.sustainabilityMetric.create({
      data: {
        userId: targetUserId,
        metricType: 'carbon_footprint',
        value: totalFootprint,
        unit: 'kg_co2',
        periodStart: new Date(today),
        periodEnd: new Date(today),
        sourceData: {
          calculation_method: 'category_based',
          items_count: wardrobeItems.length,
        },
      },
    });

    return res.status(200).json({
      success: true,
      total_footprint: totalFootprint,
      items_calculated: wardrobeItems.length,
    });
  } catch (error: any) {
    console.error('Error calculating carbon footprint:', error);
    return res.status(500).json({ error: error.message });
  }
}
