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
    console.info('Smart outfit AI function called');

    const openAIApiKey = process.env.OPENAI_API_KEY;
    const weatherApiKey = process.env.OPENWEATHER_API_KEY;

    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not configured');
    }

    if (!weatherApiKey) {
      console.error('Weather API key not found');
      throw new Error('Weather API key not configured');
    }

    const user = await requireAuth(req);
    console.info('User authenticated:', user.id);

    const { location, preferences } = req.body || {};
    console.info('Request data:', { location, preferences });

    if (!location?.trim()) {
      throw new Error('Location is required');
    }

    // Get weather data
    console.info('Fetching weather for location:', location);
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${weatherApiKey}&units=imperial`;

    const weatherResponse = await fetch(weatherUrl);
    console.info('Weather API response status:', weatherResponse.status);

    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error('Weather API error:', errorText);
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    console.info('Weather data fetched successfully:', {
      temp: weatherData.main.temp,
      condition: weatherData.weather[0].description,
    });

    // Get user's wardrobe items
    console.info('Fetching wardrobe items for user:', user.id);
    const wardrobeItems = await prisma.wardrobeItem.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, category: true, color: true, brand: true, photoUrl: true },
    });

    console.info('Wardrobe items fetched:', wardrobeItems?.length || 0, 'items');

    if (!wardrobeItems || wardrobeItems.length === 0) {
      return res.status(200).json({
        suggestions: [],
        message: 'No wardrobe items found. Please add some clothes to your wardrobe first!',
        weather: {
          temperature: weatherData.main.temp,
          condition: weatherData.weather[0].description,
          location: weatherData.name,
        },
      });
    }

    // Prepare wardrobe summary for AI
    const wardrobeSummary = wardrobeItems
      .map(
        (item) =>
          `${item.name} (${item.category}${item.color ? `, ${item.color}` : ''}${item.brand ? `, ${item.brand}` : ''})`
      )
      .join('\n');

    // Create AI prompt
    const aiPrompt = `You are a professional stylist AI. Based on the current weather and the user's wardrobe, suggest 3 complete outfit combinations.

WEATHER CONDITIONS:
- Temperature: ${weatherData.main.temp}°F
- Condition: ${weatherData.weather[0].description}
- Humidity: ${weatherData.main.humidity}%

USER'S WARDROBE:
${wardrobeSummary}

USER PREFERENCES: ${preferences || 'No specific preferences mentioned'}

Please suggest 3 complete outfits that:
1. Are appropriate for the weather conditions
2. Use only items from the user's wardrobe
3. Consider style, comfort, and practicality

For each outfit, provide:
- A catchy outfit name
- List of specific items from their wardrobe (use exact names)
- Brief explanation of why this outfit works for today's weather
- Style notes or tips

Respond with a JSON object with this structure:
{
  "suggestions": [
    {
      "name": "Outfit Name",
      "items": ["exact item name 1", "exact item name 2"],
      "reason": "Why this outfit works for the weather",
      "styleNotes": "Additional styling tips",
      "occasion": "work/casual/formal",
      "weatherScore": 95
    }
  ]
}

Only suggest outfits using items that actually exist in their wardrobe. Use the exact item names.`;

    console.info('Sending request to OpenAI...');

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are a professional fashion stylist. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: aiPrompt,
          },
        ],
        max_completion_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    console.info('OpenAI response status:', openAIResponse.status);

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);

      // Handle quota exceeded specifically
      if (openAIResponse.status === 429) {
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.code === 'insufficient_quota') {
            return res.status(200).json({
              error: 'AI styling is temporarily unavailable due to quota limits. Please try again later.',
              suggestions: [],
              weather: {
                temperature: weatherData.main.temp,
                condition: weatherData.weather[0].description,
                feelsLike: weatherData.main.feels_like,
                humidity: weatherData.main.humidity,
                location: weatherData.name,
              },
              message: 'Weather data retrieved successfully, but AI suggestions are temporarily unavailable.',
            });
          }
        } catch (parseError) {
          // Fall through to generic error
        }
      }

      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    console.info('OpenAI response received successfully');

    let aiSuggestions: any[] = [];
    try {
      const content = openAIData.choices[0].message.content;
      const parsed = JSON.parse(content);
      aiSuggestions = parsed.suggestions || [];
      console.info('AI suggestions parsed successfully:', aiSuggestions.length);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fallback suggestions
      aiSuggestions = [
        {
          name: 'Weather-Appropriate Casual',
          items: wardrobeItems.slice(0, 3).map((item) => item.name),
          reason: "Perfect for today's weather conditions",
          styleNotes: 'Simple and comfortable',
          occasion: 'casual',
          weatherScore: 85,
        },
      ];
    }

    // Match AI suggestions with actual wardrobe items
    const enhancedSuggestions = aiSuggestions.map((suggestion: any, index: number) => {
      const matchedItems = (suggestion.items || [])
        .map((itemName: string) => {
          const match = wardrobeItems.find(
            (item) =>
              item.name.toLowerCase().includes(itemName.toLowerCase()) ||
              itemName.toLowerCase().includes(item.name.toLowerCase())
          );
          return match;
        })
        .filter(Boolean);

      return {
        id: `ai-suggestion-${index + 1}`,
        name: suggestion.name || `AI Outfit ${index + 1}`,
        items: matchedItems,
        suggestedItems: suggestion.items || [],
        reason: suggestion.reason || "Perfect for today's weather",
        styleNotes: suggestion.styleNotes || '',
        occasion: suggestion.occasion || 'casual',
        weatherScore: suggestion.weatherScore || 90,
        aiGenerated: true,
      };
    });

    const result = {
      suggestions: enhancedSuggestions,
      weather: {
        temperature: weatherData.main.temp,
        condition: weatherData.weather[0].description,
        feelsLike: weatherData.main.feels_like,
        humidity: weatherData.main.humidity,
        location: weatherData.name,
      },
      wardrobeItemsCount: wardrobeItems.length,
    };

    console.info('Returning suggestions successfully:', enhancedSuggestions.length);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in smart-outfit-ai function:', error);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      error: error.message,
      suggestions: [],
      message: 'Failed to generate outfit suggestions. Please try again.',
    });
  }
}
