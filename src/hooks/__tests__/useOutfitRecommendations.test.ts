import { renderHook, act } from '@testing-library/react';
import { useOutfitRecommendations } from '../useOutfitRecommendations';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from "@/utils/logger";
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { token: 'test-token' } } }),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useOutfitRecommendations', () => {
  const mockUser = { id: 'test-user-id' };

  beforeEach(() => {
    vi.restoreAllMocks();
    (useAuth as any).mockReturnValue({ user: mockUser });
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });
  });

  it('generates suggestions based on wardrobe items', async () => {
    const mockWardrobeItems = [
      { id: '1', name: 'T-Shirt', category: 'tops', color: 'White', photo_url: null },
      { id: '2', name: 'Jeans', category: 'bottoms', color: 'Blue', photo_url: null },
      { id: '3', name: 'Sneakers', category: 'shoes', color: 'Black', photo_url: null },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockWardrobeItems),
    });

    const { result } = renderHook(() => useOutfitRecommendations());

    await act(async () => {
      await result.current.generateSuggestions();
    });

    expect(result.current.suggestions.length).toBeGreaterThan(0);
    expect(result.current.suggestions[0].items.length).toBeGreaterThanOrEqual(2);
    expect(mockFetch).toHaveBeenCalledWith('/api/wardrobe', expect.any(Object));
  });

  it('includes base item in suggestions if provided', async () => {
    const baseItem = { id: '4', name: 'Red Jacket', category: 'outerwear', color: 'Red', photo_url: null };
    const mockWardrobeItems = [
      { id: '1', name: 'T-Shirt', category: 'tops', color: 'White', photo_url: null },
      { id: '2', name: 'Jeans', category: 'bottoms', color: 'Blue', photo_url: null },
      { id: '3', name: 'Sneakers', category: 'shoes', color: 'Black', photo_url: null },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockWardrobeItems),
    });

    const { result } = renderHook(() => useOutfitRecommendations());

    await act(async () => {
      await result.current.generateSuggestions(baseItem);
    });

    const hasBaseItem = result.current.suggestions.some(s =>
      s.items.some((item: any) => item.id === baseItem.id)
    );
    expect(hasBaseItem).toBe(true);
  });

  it('successfully creates an outfit from a suggestion', async () => {
    const mockSuggestion = {
      id: 'suggestion-0',
      items: [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }],
      occasion: 'casual',
      season: 'all seasons',
      matchScore: 100,
      description: 'Test Outfit',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'outfit-123' }),
    });

    const { result } = renderHook(() => useOutfitRecommendations());

    await act(async () => {
      await result.current.createOutfitFromSuggestion(mockSuggestion as any, 'My New Outfit');
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/outfits', expect.objectContaining({ method: 'POST' }));
  });

  it('handles errors during suggestion generation', async () => {
    mockFetch.mockResolvedValue({ ok: false, text: vi.fn().mockResolvedValue('Database error') });

    const { result } = renderHook(() => useOutfitRecommendations());

    await act(async () => {
      await result.current.generateSuggestions();
    });

    expect(logger.error).toHaveBeenCalled();
    expect(result.current.suggestions).toEqual([]);
  });
});
