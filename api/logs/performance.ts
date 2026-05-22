import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  timestamp: number;
  url: string;
  userAgent: string;
}

interface CustomMetric {
  name: string;
  value: number;
  timestamp: number;
  context?: Record<string, any>;
  url: string;
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
    const user = await requireAuth(req);

    const { metric, custom_metric, user_id = user.id, session_id } = req.body || {};

    // Log performance data
    if (metric) {
      const performanceData = {
        ...(metric as PerformanceMetric),
        user_id,
        session_id,
        timestamp: new Date().toISOString(),
      };

      console.info('Performance Metric:', JSON.stringify(performanceData, null, 2));

      // Check for performance issues
      if ((metric as PerformanceMetric).rating === 'poor') {
        console.warn(
          `Poor performance detected - ${(metric as PerformanceMetric).name}: ${(metric as PerformanceMetric).value}`
        );

        if ((metric as PerformanceMetric).name === 'LCP' && (metric as PerformanceMetric).value > 4000) {
          console.error('Critical LCP performance issue detected');
        }
      }
    }

    // Log custom metrics
    if (custom_metric) {
      const customData = {
        ...(custom_metric as CustomMetric),
        user_id,
        timestamp: new Date().toISOString(),
      };

      console.info('Custom Metric:', JSON.stringify(customData, null, 2));
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('Error in performance-logger:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
