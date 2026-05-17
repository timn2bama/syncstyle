import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from "@/utils/logger";

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

export function useRealUserMonitoring() {
  const { user } = useAuth();

  const getDeviceInfo = () => ({
    user_agent: navigator.userAgent,
    screen_resolution: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    connection: (navigator as any).connection?.effectiveType || 'unknown'
  });

  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  };

  const initializeSession = useCallback(async () => {
    const sessionId = getSessionId();
    const session: UserSession = {
      session_id: sessionId,
      user_id: user?.id,
      start_time: Date.now(),
      page_views: 1,
      interactions: 0,
      errors: 0,
      device_info: getDeviceInfo()
    };

    if (import.meta.env.DEV) {
      logger.info('RUM Session initialized:', session);
      return;
    }

    try {
      await fetch('/api/logs/rum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'session_start', session })
      });
    } catch (error) {
      logger.error('Failed to initialize RUM session:', error);
    }
  }, [user?.id]);

  const trackInteraction = useCallback(async (interaction: Omit<UserInteraction, 'timestamp' | 'page'>) => {
    const sessionId = getSessionId();
    const fullInteraction: UserInteraction = {
      ...interaction,
      timestamp: Date.now(),
      page: window.location.pathname
    };

    if (import.meta.env.DEV) {
      logger.info('RUM Interaction:', fullInteraction);
      return;
    }

    try {
      await fetch('/api/logs/rum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'interaction', session_id: sessionId, interaction: fullInteraction })
      });
    } catch (error) {
      logger.error('Failed to track interaction:', error);
    }
  }, []);

  const trackPageView = useCallback(async (path: string) => {
    const sessionId = getSessionId();

    if (import.meta.env.DEV) {
      logger.info('RUM Page view:', path);
      return;
    }

    try {
      await fetch('/api/logs/rum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'page_view', session_id: sessionId, path, timestamp: Date.now() })
      });
    } catch (error) {
      logger.error('Failed to track page view:', error);
    }
  }, []);

  const trackError = useCallback(async (error: Error, context?: Record<string, any>) => {
    const sessionId = getSessionId();

    if (import.meta.env.DEV) {
      logger.info('RUM Error:', error, context);
      return;
    }

    try {
      await fetch('/api/logs/rum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'error',
          session_id: sessionId,
          error: { message: error.message, stack: error.stack, name: error.name, context },
          timestamp: Date.now()
        })
      });
    } catch (rumError) {
      logger.error('Failed to track error:', rumError);
    }
  }, []);

  useEffect(() => {
    initializeSession();

    // Track clicks
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      trackInteraction({
        type: 'click',
        target: target.tagName + (target.id ? `#${target.id}` : '') + (target.className ? `.${target.className.split(' ')[0]}` : '')
      });
    };

    // Track scrolling
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        trackInteraction({
          type: 'scroll',
          value: {
            scrollY: window.scrollY,
            scrollX: window.scrollX
          }
        });
      }, 100);
    };

    // Track window resize
    const handleResize = () => {
      trackInteraction({
        type: 'resize',
        value: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });
    };

    // Track errors
    const handleError = (event: ErrorEvent) => {
      trackError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    // Track unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackError(new Error('Unhandled Promise Rejection'), {
        reason: event.reason
      });
    };

    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [initializeSession, trackInteraction, trackError]);

  return {
    trackInteraction,
    trackPageView,
    trackError
  };
}