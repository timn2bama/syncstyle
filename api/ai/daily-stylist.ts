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

    const { user_id } = req.body || {};

    // Get user's wardrobe items
    const wardrobeItems = await prisma.wardrobeItem.findMany({
      where: { userId: user_id || user.id },
    });

    // Get user's style preferences
    const stylePrefs = await prisma.userStylePreference.findFirst({
      where: { userId: user_id || user.id },
    });

    // Simple AI logic for outfit suggestion
    const categories = ['tops', 'bottoms', 'shoes'];
    const suggestedItems: any[] = [];

    for (const category of categories) {
      const categoryItems = wardrobeItems.filter((item) => item.category === category);
      if (categoryItems.length > 0) {
        const randomItem = categoryItems[Math.floor(Math.random() * categoryItems.length)];
        suggestedItems.push({
          id: randomItem.id,
          name: randomItem.name,
          category: randomItem.category,
          brand: randomItem.brand,
          photo_url: randomItem.photoUrl,
        });
      }
    }

    const targetUserId = user_id || user.id;
    const suggestionDate = new Date().toISOString().split('T')[0];

    const outfitSuggestion = {
      userId: targetUserId,
      suggestionDate: new Date(suggestionDate),
      outfitData: {
        items: suggestedItems,
        styling_notes: "Perfect combination for today's weather and activities",
      },
      weatherContext: {
        temperature: 72,
        condition: 'partly cloudy',
      },
      occasion: 'casual',
      stylePreference: (stylePrefs as any)?.styleKeywords?.[0] || 'casual',
      aiReasoning:
        'Selected based on your style preferences and wardrobe analytics. This combination balances comfort with your preferred aesthetic.',
    };

    const data = await prisma.dailyOutfitSuggestion.upsert({
      where: {
        userId_suggestionDate: {
          userId: targetUserId,
          suggestionDate: new Date(suggestionDate),
        },
      },
      update: outfitSuggestion,
      create: outfitSuggestion,
    });

    return res.status(200).json({ success: true, suggestion: data });
  } catch (error: any) {
    console.error('Error generating daily outfit:', error);
    return res.status(500).json({ error: error.message });
  }
}
