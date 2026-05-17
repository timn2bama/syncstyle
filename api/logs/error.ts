import type { VercelRequest, VercelResponse } from '@vercel/node';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

interface ErrorLogEntry {
  message: string;
  stack?: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgent: string;
  timestamp: number;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
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
    const { error }: { error: ErrorLogEntry } = req.body || {};

    // Log error with severity-based formatting
    const logLevel =
      error.severity === 'critical' ? 'error' : error.severity === 'high' ? 'warn' : 'info';

    const logEntry = {
      timestamp: new Date(error.timestamp).toISOString(),
      severity: error.severity,
      message: error.message,
      url: error.url,
      userId: error.userId || 'anonymous',
      userAgent: error.userAgent,
      stack: error.stack,
      context: error.context,
      lineNumber: error.lineNumber,
      columnNumber: error.columnNumber,
    };

    if (logLevel === 'error') {
      console.error('Error Log:', JSON.stringify(logEntry, null, 2));
    } else if (logLevel === 'warn') {
      console.warn('Error Log:', JSON.stringify(logEntry, null, 2));
    } else {
      console.info('Error Log:', JSON.stringify(logEntry, null, 2));
    }

    // Check for critical errors that need immediate attention
    if (error.severity === 'critical') {
      console.error('CRITICAL ERROR DETECTED - IMMEDIATE ATTENTION REQUIRED');
      // Could trigger alerts here: Slack, email, PagerDuty, etc.
    }

    // Check for common error patterns
    if (error.message.includes('ChunkLoadError')) {
      console.warn('JavaScript chunk loading error - possible deployment issue');
    }

    if (error.message.includes('Network Error')) {
      console.warn('Network connectivity issue detected');
    }

    if (error.stack?.includes('react-router')) {
      console.warn('React Router error - possible navigation issue');
    }

    return res.status(200).json({ success: true, logged: true });
  } catch (err: any) {
    console.error('Error in error-logger function:', err);
    return res.status(500).json({ error: 'Failed to log error' });
  }
}
