/**
 * Authentication hooks using React Query
 * 
 * Provides mutations and queries for user authentication operations
 * with built-in error handling, rate limiting, and security measures.
 * 
 * @module hooks/queries/useAuth
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { useToast } from '@/hooks/use-toast';
import { validateEmail, getSafeErrorMessage, rateLimiter } from '@/lib/security';
import { logger } from "@/utils/logger";

/**
 * Hook to fetch user subscription status
 * 
 * @param userId - The user ID to check subscription for
 * @returns Query result with subscription data
 * 
 * @example
 * ```typescript
 * const { data: subscription, isLoading } = useSubscriptionQuery(user?.id);
 * if (subscription?.subscribed) {
 *   // Show premium features
 * }
 * ```
 */
export const useSubscriptionQuery = (userId?: string) => {
  return useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      if (!userId) return { subscribed: false };
      
      const response = await fetch('/api/analytics/subscription');
      if (!response.ok) {
        logger.warn('Subscription check failed:', response.statusText);
        return { subscribed: false }; // Graceful fallback
      }
      return response.json();
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    retry: false, // Don't retry subscription checks to avoid spam
  });
};

/**
 * Hook for user sign-in with email/password
 * 
 * Features:
 * - Email validation
 * - Rate limiting (5 attempts per 5 minutes)
 * - Automatic toast notifications
 * - Security error handling
 * 
 * @returns Mutation object for sign-in operation
 * 
 * @example
 * ```typescript
 * const signInMutation = useSignInMutation();
 * 
 * const handleSignIn = async () => {
 *   await signInMutation.mutateAsync({
 *     email: "user@example.com",
 *     password: "securePassword123"
 *   });
 * };
 * ```
 */
export const useSignInMutation = () => {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      // Rate limiting for failed login attempts
      const loginKey = `login-${email.toLowerCase()}`;
      if (!rateLimiter.isAllowed(loginKey, 5, 300000)) {
        throw new Error('Too many login attempts. Please wait before trying again.');
      }

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.error || 'Invalid email');
      }

      const { error } = await authClient.signIn.email({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        throw new Error(getSafeErrorMessage(error));
      } else {
        // Reset rate limiter on successful login
        rateLimiter.reset(loginKey);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });
    }
  });
};

/**
 * Hook for user registration
 * 
 * Features:
 * - Email validation and sanitization
 * - Password strength requirements (min 8 characters)
 * - Rate limiting (3 attempts per 5 minutes)
 * - Email confirmation flow
 * - Automatic toast notifications
 * 
 * @returns Mutation object for sign-up operation
 * 
 * @example
 * ```typescript
 * const signUpMutation = useSignUpMutation();
 * 
 * const handleSignUp = async () => {
 *   await signUpMutation.mutateAsync({
 *     email: "user@example.com",
 *     password: "securePassword123",
 *     displayName: "John Doe"
 *   });
 * };
 * ```
 */
export const useSignUpMutation = () => {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      email, 
      password, 
      displayName 
    }: { 
      email: string; 
      password: string; 
      displayName?: string; 
    }) => {
      // Rate limiting
      if (!rateLimiter.isAllowed('signup', 3, 300000)) {
        throw new Error('Too many signup attempts. Please wait before trying again.');
      }

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.error || 'Invalid email');
      }

      // Password strength check
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const { error } = await authClient.signUp.email({
        email: email.toLowerCase().trim(),
        password,
        name: displayName?.trim(),
      });

      if (error) {
        throw new Error(getSafeErrorMessage(error));
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Account created!",
        description: "Please check your email to confirm your account.",
      });
    }
  });
};

/**
 * Hook for user sign-out
 * 
 * Features:
 * - Clears all cached React Query data
 * - Automatic toast notification
 * - Error handling
 * 
 * @returns Mutation object for sign-out operation
 * 
 * @example
 * ```typescript
 * const signOutMutation = useSignOutMutation();
 * 
 * const handleSignOut = async () => {
 *   await signOutMutation.mutateAsync();
 *   navigate('/auth');
 * };
 * ```
 */
export const useSignOutMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      // Clear all cached data on sign out
      queryClient.clear();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sign Out Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
};