import { renderHook, waitFor, act } from '@testing-library/react';
import { useSubscriptionQuery, useSignInMutation, useSignUpMutation } from '../useAuth';
import { authClient } from '@/lib/auth-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';

// Mock Better Auth client
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
    signUp: {
      email: vi.fn(),
    },
    signOut: vi.fn(),
    getSession: vi.fn(),
  },
}));

// Mock fetch for subscription endpoint
global.fetch = vi.fn();

const mockToast = vi.fn();

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: mockToast,
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('Auth Hooks', () => {
  // Use mockToast directly instead of calling the hook here
  const toast = mockToast;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('useSubscriptionQuery', () => {
    it('returns pending state when no userId is provided', async () => {
      const { result } = renderHook(() => useSubscriptionQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.status).toBe('pending');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('calls check-subscription endpoint when userId is provided', async () => {
      const mockData = { subscribed: true, subscription_tier: 'Premium' };
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useSubscriptionQuery('test-user-id'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('/api/analytics/subscription');
    });

    it('handles errors gracefully by returning unsubscribed', async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        statusText: 'Network error',
      });

      const { result } = renderHook(() => useSubscriptionQuery('test-user-id'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ subscribed: false });
    });
  });

  describe('useSignInMutation', () => {
    it('successfully signs in a user', async () => {
      (authClient.signIn.email as Mock).mockResolvedValue({ data: { user: {} }, error: null });

      const { result } = renderHook(() => useSignInMutation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ email: 'test@example.com', password: 'password123' });
      });

      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Welcome back!',
      }));
    });

    it('shows error toast on sign-in failure', async () => {
      (authClient.signIn.email as Mock).mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' }
      });

      const { result } = renderHook(() => useSignInMutation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ email: 'test@example.com', password: 'wrong' });
        } catch (e) {
          // Expected error
        }
      });

      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Sign In Failed',
        description: 'Invalid credentials',
      }));
    });
  });

  describe('useSignUpMutation', () => {
    it('successfully signs up a new user', async () => {
      (authClient.signUp.email as Mock).mockResolvedValue({ data: { user: {} }, error: null });

      const { result } = renderHook(() => useSignUpMutation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          email: 'new@example.com',
          password: 'password123',
          displayName: 'New User'
        });
      });

      expect(authClient.signUp.email).toHaveBeenCalledWith(expect.objectContaining({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      }));
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Account created!',
      }));
    });
  });
});
