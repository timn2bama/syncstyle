import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from "@/utils/logger";

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

export const useErrorLogger = () => {
  const { user } = useAuth();

  const logError = async (error: Error | ErrorEvent, severity: ErrorLogEntry['severity'] = 'medium', context?: Record<string, any>) => {
    const errorEntry: ErrorLogEntry = {
      message: error instanceof Error ? error.message : error.message,
      stack: error instanceof Error ? error.stack : undefined,
      url: window.location.href,
      lineNumber: error instanceof ErrorEvent ? error.lineno : undefined,
      columnNumber: error instanceof ErrorEvent ? error.colno : undefined,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      userId: user?.id,
      severity,
      context
    };

    // Log to console in development
    if (import.meta.env.DEV) {
      logger.error('Error logged:', errorEntry);
      return;
    }

    try {
      await fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: errorEntry })
      });
    } catch (logError) {
      logger.error('Failed to log error:', logError);
    }
  };

  const logCustomError = (message: string, severity: ErrorLogEntry['severity'] = 'medium', context?: Record<string, any>) => {
    const customError = new Error(message);
    logError(customError, severity, context);
  };

  useEffect(() => {
    // Global error handler
    const handleError = (event: ErrorEvent) => {
      logError(event, 'high');
    };

    // Unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = new Error(`Unhandled Promise Rejection: ${event.reason}`);
      logError(error, 'critical');
    };

    // React error boundary doesn't catch all errors, so we need global handlers
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [user]);

  return {
    logError,
    logCustomError
  };
};