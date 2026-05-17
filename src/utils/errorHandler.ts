import { toast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth-client";
import { logger } from "@/utils/logger";

/**
 * Error context for categorizing errors
 */
export type ErrorContext = 
  | 'auth'
  | 'wardrobe'
  | 'outfit'
  | 'upload'
  | 'network'
  | 'database'
  | 'validation'
  | 'subscription'
  | 'ai'
  | 'general';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Structured error details for logging
 */
interface ErrorDetails {
  context: ErrorContext;
  error: unknown;
  userId?: string;
  metadata?: Record<string, any>;
  severity?: ErrorSeverity;
}

/**
 * User-friendly error messages by context
 */
const ERROR_MESSAGES: Record<ErrorContext, string> = {
  auth: 'Authentication failed. Please try again.',
  wardrobe: 'Failed to update wardrobe. Please try again.',
  outfit: 'Failed to process outfit. Please try again.',
  upload: 'Failed to upload image. Please check your file and try again.',
  network: 'Network error. Please check your connection and try again.',
  database: 'Database error. Please try again later.',
  validation: 'Invalid input. Please check your data.',
  subscription: 'Subscription error. Please contact support.',
  ai: 'AI service temporarily unavailable. Please try again later.',
  general: 'Something went wrong. Please try again.',
};

/**
 * Get user-friendly error message from an error object
 */
export function getUserFriendlyMessage(error: unknown, context?: ErrorContext): string {
  // If error is a string, return it
  if (typeof error === 'string') {
    return error;
  }

  // If error has a message property
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as Error).message;
    
    // Don't expose technical details in production
    if (import.meta.env.PROD && isSystemError(message)) {
      return context ? ERROR_MESSAGES[context] : ERROR_MESSAGES.general;
    }
    
    return message;
  }

  // Fallback to context-specific message
  return context ? ERROR_MESSAGES[context] : ERROR_MESSAGES.general;
}

/**
 * Check if error message contains system/technical details
 */
function isSystemError(message: string): boolean {
  const systemErrorPatterns = [
    /database/i,
    /connection/i,
    /timeout/i,
    /internal server/i,
    /undefined/i,
    /null reference/i,
  ];
  
  return systemErrorPatterns.some(pattern => pattern.test(message));
}

/**
 * Log error to monitoring service in production
 */
async function logToMonitoring(details: ErrorDetails): Promise<void> {
  if (!import.meta.env.PROD) {
    return;
  }

  try {
    await fetch('/api/logs/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: details.context,
        error: getErrorInfo(details.error),
        userId: details.userId,
        metadata: details.metadata,
        severity: details.severity || 'medium',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    });
  } catch (loggingError) {
    // Don't throw if logging fails - just log to console
    logger.error('Failed to log to monitoring:', loggingError);
  }
}

/**
 * Extract error information safely
 */
function getErrorInfo(error: unknown): Record<string, any> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  
  if (typeof error === 'string') {
    return { message: error };
  }
  
  try {
    return { raw: JSON.stringify(error) };
  } catch {
    return { raw: String(error) };
  }
}

/**
 * Main error handler - use this throughout the application
 * 
 * @example
 * ```typescript
 * try {
 *   await uploadImage(file);
 * } catch (error) {
 *   handleError(error, 'upload', { fileName: file.name });
 * }
 * ```
 */
export async function handleError(
  error: unknown,
  context: ErrorContext,
  metadata?: Record<string, any>,
  options?: {
    showToast?: boolean;
    severity?: ErrorSeverity;
    customMessage?: string;
  }
): Promise<void> {
  const {
    showToast = true,
    severity = 'medium',
    customMessage,
  } = options || {};

  // Console log in development
  if (import.meta.env.DEV) {
    logger.error(`[${context.toUpperCase()}]`, error);
    if (metadata) {
      logger.error('Metadata:', metadata);
    }
  }

  // Get current user ID if available
  const { data: sessionData } = await authClient.getSession().catch(() => ({ data: null }));
  const user = sessionData?.user ?? null;

  // Log to monitoring service
  await logToMonitoring({
    context,
    error,
    userId: user?.id,
    metadata,
    severity,
  });

  // Show toast notification
  if (showToast) {
    const message = customMessage || getUserFriendlyMessage(error, context);
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  }
}

/**
 * Handle successful operations with consistent toast messages
 */
export function handleSuccess(
  message: string,
  options?: {
    title?: string;
    description?: string;
  }
): void {
  toast({
    title: options?.title || "Success",
    description: options?.description || message,
  });
}

/**
 * Async operation wrapper with automatic error handling
 * 
 * @example
 * ```typescript
 * await withErrorHandling(
 *   async () => {
 *     const data = await fetchData();
 *     return data;
 *   },
 *   'database',
 *   { operation: 'fetch-data' }
 * );
 * ```
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  metadata?: Record<string, any>,
  options?: {
    showToast?: boolean;
    severity?: ErrorSeverity;
    fallbackValue?: T;
  }
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    await handleError(error, context, metadata, {
      showToast: options?.showToast,
      severity: options?.severity,
    });
    return options?.fallbackValue;
  }
}

/**
 * Rate limiter for error reporting (prevent spam)
 */
class ErrorRateLimiter {
  private errorCounts: Map<string, { count: number; timestamp: number }> = new Map();
  private readonly maxErrors = 5;
  private readonly windowMs = 60000; // 1 minute

  shouldReport(errorKey: string): boolean {
    const now = Date.now();
    const existing = this.errorCounts.get(errorKey);

    if (!existing || now - existing.timestamp > this.windowMs) {
      this.errorCounts.set(errorKey, { count: 1, timestamp: now });
      return true;
    }

    if (existing.count >= this.maxErrors) {
      return false;
    }

    existing.count++;
    return true;
  }
}

export const errorRateLimiter = new ErrorRateLimiter();
