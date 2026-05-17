import type { VercelRequest, VercelResponse } from '@vercel/node';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

interface SecurityEvent {
  event_type: 'failed_login' | 'suspicious_activity' | 'rate_limit_exceeded' | 'invalid_input';
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details: Record<string, any>;
}

function getSeverityLevel(eventType: string): 'low' | 'medium' | 'high' {
  switch (eventType) {
    case 'failed_login': return 'medium';
    case 'suspicious_activity': return 'high';
    case 'rate_limit_exceeded': return 'medium';
    case 'invalid_input': return 'low';
    default: return 'low';
  }
}

async function checkForSuspiciousPatterns(logEntry: any) {
  try {
    if (logEntry.event_type === 'failed_login') {
      console.warn(`Failed login attempt from IP: ${logEntry.ip_address}`);
    }
    if (logEntry.event_type === 'rate_limit_exceeded') {
      console.warn(`Rate limit exceeded from IP: ${logEntry.ip_address}`);
    }
  } catch (error) {
    console.error('Error checking suspicious patterns:', error);
  }
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
    const clientIP = (req.headers['x-forwarded-for'] as string) || 'unknown';

    const { event_type, user_id, details }: SecurityEvent = req.body || {};

    // Validate input
    if (!event_type || !details) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    // Log security event
    const logEntry = {
      event_type,
      user_id: user_id || null,
      ip_address: clientIP,
      user_agent: userAgent,
      details,
      timestamp: new Date().toISOString(),
      severity: getSeverityLevel(event_type),
    };

    console.info('Security Event:', JSON.stringify(logEntry, null, 2));

    // Check for patterns that might indicate an attack
    await checkForSuspiciousPatterns(logEntry);

    return res.status(200).json({ success: true, logged: true });
  } catch (err: any) {
    console.error('Error in security-logger function:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
