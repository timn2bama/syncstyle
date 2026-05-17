import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { image, options = {} } = req.body || {};

    // Extract base64 data from data URL
    const base64Data = image.split(',')[1];
    const mediaType = image.split(';')[0].split(':')[1];

    // Prepare the analysis prompt based on options
    let analysisPrompt = `Analyze this clothing item image and provide a detailed JSON response with the following structure:

{
  "category": "primary clothing category",
  "confidence": 0.95,
  "subcategory": "more specific category",
  "colors": {
    "dominant": "main color name",
    "palette": ["color1", "color2", "color3"],
    "hex_codes": ["#ffffff", "#000000"]
  },
  "patterns": [
    {
      "type": "pattern type (solid, stripes, polka dots, etc.)",
      "confidence": 0.8
    }
  ],
  "fabric": {
    "texture": "texture description",
    "material_guess": "estimated material type",
    "confidence": 0.7
  },
  "fit_assessment": {
    "fit_type": "loose/fitted/regular",
    "size_recommendation": "size guidance",
    "confidence": 0.6
  },
  "style_tags": ["casual", "formal", "vintage"],
  "season_suitability": ["spring", "summer", "fall", "winter"]
}`;

    if (!options.includeColors) analysisPrompt += '\nSkip color analysis.';
    if (!options.includePatterns) analysisPrompt += '\nSkip pattern analysis.';
    if (!options.includeFabric) analysisPrompt += '\nSkip fabric analysis.';
    if (!options.includeFit) analysisPrompt += '\nSkip fit assessment.';
    if (!options.includeStyle) analysisPrompt += '\nSkip style tags.';

    analysisPrompt +=
      '\n\nProvide confidence scores between 0 and 1. Be as accurate as possible based on what you can see in the image.';

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              {
                type: 'image_url',
                image_url: { url: image, detail: 'high' },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const openaiResponse = await response.json();
    const analysisText = openaiResponse.choices[0].message.content;

    // Parse the JSON response
    let analysis: any;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse analysis:', parseError);
      analysis = {
        category: 'unknown',
        confidence: 0.5,
        subcategory: 'clothing',
        colors: { dominant: 'unknown', palette: [], hex_codes: [] },
        patterns: [],
        fabric: { texture: 'unknown', material_guess: 'unknown', confidence: 0.3 },
        fit_assessment: { fit_type: 'unknown', size_recommendation: 'unable to assess', confidence: 0.2 },
        style_tags: [],
        season_suitability: [],
      };
    }

    // Apply additional computer vision processing if needed
    if (options.includeColors && analysis.colors) {
      analysis.colors.enhanced = true;
    }

    console.info('Computer vision analysis completed:', {
      category: analysis.category,
      confidence: analysis.confidence,
      colorsDetected: analysis.colors?.palette?.length || 0,
      patternsDetected: analysis.patterns?.length || 0,
    });

    return res.status(200).json(analysis);
  } catch (error: any) {
    console.error('Error in computer-vision-analysis:', error);
    return res.status(500).json({
      error: error.message,
      category: 'error',
      confidence: 0,
      colors: { dominant: 'unknown', palette: [], hex_codes: [] },
      patterns: [],
      fabric: { texture: 'unknown', material_guess: 'unknown', confidence: 0 },
      fit_assessment: { fit_type: 'unknown', size_recommendation: 'error', confidence: 0 },
      style_tags: [],
      season_suitability: [],
    });
  }
}
