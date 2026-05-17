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
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    const user = await requireAuth(req);
    if (!user) throw new Error('Not authenticated');

    const { type, data, context, language = 'en' } = req.body || {};

    // Fetch user style preferences
    const preferences = await prisma.userStylePreference.findFirst({
      where: { userId: user.id },
    });

    let prompt = '';
    let imageData: string | null = null;

    if (type === 'visual') {
      // Handle image analysis
      imageData = data;

      if (context?.task === 'clothing_analysis') {
        prompt = `Analyze this clothing item image and provide detailed information about:
        - Category and subcategory
        - Color analysis (dominant colors and full palette)
        - Pattern recognition
        - Fabric texture and material estimation
        - Style characteristics
        - Season suitability
        - Fit assessment if visible

        User preferences: ${JSON.stringify((preferences as any)?.preferences || {})}
        Respond in ${language}.
        Format as detailed JSON with confidence scores.`;
      } else if (context?.task === 'outfit_analysis') {
        prompt = `Analyze this outfit and provide:
        - Overall style assessment
        - Color harmony analysis
        - Occasion appropriateness
        - Improvement suggestions
        - Alternative styling options

        User context: ${JSON.stringify(context)}
        User preferences: ${JSON.stringify((preferences as any)?.preferences || {})}
        Respond in ${language}.`;
      }
    } else if (type === 'text') {
      if (context?.task === 'personalized_advice') {
        prompt = `${data}

        Consider the user's style preferences: ${JSON.stringify((preferences as any)?.preferences || {})}
        Favorite colors: ${(preferences as any)?.favoriteColors || []}
        Style keywords: ${(preferences as any)?.styleKeywords || []}

        Provide personalized, actionable advice in ${language}.
        Be specific and consider their personal style preferences.`;
      }
    }

    // Prepare Claude API request messages
    const messages: any[] = [];

    if (imageData) {
      // Extract base64 data from data URL
      const base64Data = imageData.split(',')[1];
      const mediaType = imageData.split(';')[0].split(':')[1];

      messages.push({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: prompt,
      });
    }

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages,
        system:
          'You are an expert fashion AI assistant with advanced capabilities in visual analysis, contextual memory, and personalized responses. You provide detailed, accurate, and helpful fashion advice tailored to individual users.',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API error:', errorData);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const claudeResponse = await response.json();
    const analysisText = claudeResponse.content[0].text;

    // Try to parse as JSON for structured responses
    let analysis: any;
    let suggestions: string[] = [];
    let confidence = 0.9;
    let metadata = {};

    try {
      const parsed = JSON.parse(analysisText);
      analysis = parsed.analysis || analysisText;
      suggestions = parsed.suggestions || [];
      confidence = parsed.confidence || 0.9;
      metadata = parsed.metadata || {};
    } catch {
      // If not JSON, treat as plain text
      analysis = analysisText;
      const suggestionLines = analysisText
        .split('\n')
        .filter(
          (line: string) =>
            line.includes('suggest') || line.includes('recommend') || line.includes('consider')
        );
      suggestions = suggestionLines.slice(0, 3);
    }

    // Store analysis in user's contextual memory
    await prisma.userStylePreference.upsert({
      where: { userId: user.id },
      update: {
        preferences: {
          ...((preferences as any)?.preferences || {}),
          last_analysis: {
            timestamp: new Date().toISOString(),
            type: context?.task,
            language,
          },
        },
      },
      create: {
        userId: user.id,
        preferences: {
          last_analysis: {
            timestamp: new Date().toISOString(),
            type: context?.task,
            language,
          },
        },
      },
    });

    return res.status(200).json({
      analysis,
      suggestions,
      confidence,
      metadata,
      capabilities_used: {
        visual_analysis: !!imageData,
        contextual_memory: true,
        personalized_responses: true,
        multi_language: language !== 'en',
      },
    });
  } catch (error: any) {
    console.error('Error in enhanced-claude-analysis:', error);
    return res.status(500).json({
      error: error.message,
      analysis: 'Analysis temporarily unavailable',
      suggestions: [],
      confidence: 0,
    });
  }
}
