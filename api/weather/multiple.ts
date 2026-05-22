import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

// In-memory rate limiting (per cold-start instance)
const weatherMultipleRequests = new Map<string, number[]>();

function getWeatherIcon(condition: string): string {
  const iconMap: { [key: string]: string } = {
    Clear: '☀️',
    Clouds: '☁️',
    Rain: '🌧️',
    Drizzle: '🌦️',
    Thunderstorm: '⛈️',
    Snow: '❄️',
    Mist: '🌫️',
    Fog: '🌫️',
    Haze: '🌫️',
  };
  return iconMap[condition] || '🌤️';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers['origin'] as string) || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await requireAuth(req);

    // Rate limiting
    const clientIP =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';
    const rateLimitKey = `weather-multiple-${clientIP}`;
    const now = Date.now();
    const userRequests = weatherMultipleRequests.get(rateLimitKey) || [];
    const recentRequests = userRequests.filter((time) => now - time < 60000);

    if (recentRequests.length >= 5) {
      return res
        .status(429)
        .json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    recentRequests.push(now);
    weatherMultipleRequests.set(rateLimitKey, recentRequests);

    const { locations } = req.body || {};

    // Input validation
    if (!Array.isArray(locations) || locations.length === 0 || locations.length > 10) {
      return res
        .status(400)
        .json({ error: 'Invalid locations array. Must be 1-10 locations.' });
    }

    // Validate each location
    for (const loc of locations) {
      if (
        !loc.latitude ||
        !loc.longitude ||
        typeof loc.latitude !== 'number' ||
        typeof loc.longitude !== 'number' ||
        loc.latitude < -90 ||
        loc.latitude > 90 ||
        loc.longitude < -180 ||
        loc.longitude > 180
      ) {
        return res
          .status(400)
          .json({ error: 'Invalid coordinates in locations array' });
      }
    }

    const apiKey = process.env.WEATHERAPI_KEY;
    if (!apiKey) {
      console.error('WEATHERAPI_KEY not found in environment');
      return res.status(500).json({ error: 'Weather API key not configured' });
    }

    console.info(`Fetching weather for ${locations.length} locations`);

    // Fetch weather for all locations in parallel
    const weatherPromises = locations.map(
      async (location: { latitude: number; longitude: number; name?: string }) => {
        try {
          console.info(
            `Fetching weather for ${location.name}: ${location.latitude}, ${location.longitude}`
          );

          const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location.latitude},${location.longitude}&days=6&aqi=no&alerts=no`;

          const weatherResponse = await fetch(weatherUrl);

          if (!weatherResponse.ok) {
            const errorText = await weatherResponse.text();
            console.error(
              `Failed to fetch weather for ${location.name || 'location'}:`,
              weatherResponse.status,
              errorText
            );
            throw new Error(`Weather API error: ${weatherResponse.status} - ${errorText}`);
          }

          const weatherData = await weatherResponse.json();

          // Process forecast data — skip today, get next 5 days
          const dailyForecasts: any[] = [];
          for (let i = 1; i < Math.min(weatherData.forecast.forecastday.length, 6); i++) {
            const day = weatherData.forecast.forecastday[i];
            const date = new Date(day.date);
            dailyForecasts.push({
              day: date.toLocaleDateString('en-US', { weekday: 'long' }),
              high: Math.round(day.day.maxtemp_f),
              low: Math.round(day.day.mintemp_f),
              condition: day.day.condition.text,
              icon: getWeatherIcon(day.day.condition.text),
            });
          }

          return {
            location: location.name || weatherData.location.name,
            latitude: location.latitude,
            longitude: location.longitude,
            current: {
              temperature: Math.round(weatherData.current.temp_f),
              condition: weatherData.current.condition.text,
              humidity: weatherData.current.humidity,
              windSpeed: Math.round(weatherData.current.wind_mph),
              icon: getWeatherIcon(weatherData.current.condition.text),
              city: weatherData.location.name,
            },
            forecast: dailyForecasts,
          };
        } catch (error: any) {
          console.error(
            `Error fetching weather for ${location.name || 'location'}:`,
            error
          );
          return {
            location: location.name || 'Unknown',
            latitude: location.latitude,
            longitude: location.longitude,
            error: error.message,
          };
        }
      }
    );

    const results = await Promise.all(weatherPromises);
    console.info(`Weather data fetched for ${results.length} locations`);

    return res.status(200).json({ locations: results });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('Error in get-weather-multiple function:', error);
    return res.status(500).json({ error: error.message });
  }
}
