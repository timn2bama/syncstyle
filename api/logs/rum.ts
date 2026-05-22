import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

interface UserSession {
  session_id: string;
  user_id?: string;
  start_time: number;
  page_views: number;
  interactions: number;
  errors: number;
  device_info: {
    user_agent: string;
    screen_resolution: string;
    viewport: string;
    connection: string;
  };
}

interface UserInteraction {
  type: 'click' | 'scroll' | 'resize' | 'navigation' | 'error';
  timestamp: number;
  target?: string;
  value?: any;
  page: string;
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

    const { action, session, session_id, interaction, path, error, timestamp } = req.body || {};

    switch (action) {
      case 'session_start':
        console.info('RUM Session Started:', JSON.stringify(session as UserSession, null, 2));
        // Store session data in analytics database
        break;

      case 'page_view':
        console.info('RUM Page View:', { session_id, path, timestamp });
        // Track page views for user journey analysis
        break;

      case 'interaction':
        console.info(
          'RUM Interaction:',
          JSON.stringify({ session_id, interaction: interaction as UserInteraction }, null, 2)
        );
        // Track user interactions for UX analysis
        break;

      case 'error':
        console.error('RUM Error:', JSON.stringify({ session_id, error, timestamp }, null, 2));
        // Log errors for debugging and monitoring

        if (error?.name === 'ChunkLoadError' || error?.message?.includes('Loading chunk')) {
          console.error('Critical: JavaScript chunk loading error detected');
        }
        break;

      default:
        console.warn('Unknown RUM action:', action);
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Unauthorized' });
    console.error('Error in rum-logger:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
