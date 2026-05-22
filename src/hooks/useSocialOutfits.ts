import { useState, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from "@/utils/logger";

export interface SocialOutfit {
  id: string;
  name: string;
  description: string | null;
  occasion: string | null;
  season: string | null;
  is_public: boolean;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  outfit_items: {
    id: string;
    wardrobe_items: {
      id: string;
      name: string;
      category: string;
      color: string | null;
      photo_url: string | null;
    };
  }[];
  _count?: {
    likes: number;
    comments: number;
    ratings: number;
  };
  user_liked?: boolean;
  user_rating?: number;
  avg_rating?: number;
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: sessionData } = await authClient.getSession();
  if (!sessionData?.session) return {};
  return {
    'Authorization': `Bearer ${sessionData.session.token}`,
    'Content-Type': 'application/json',
  };
};

export function useSocialOutfits() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchPublicOutfits = useCallback(async (limit = 20, offset = 0) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/outfits', { headers });
      if (!response.ok) throw new Error(await response.text());
      const data: SocialOutfit[] = await response.json();
      // Filter public outfits client-side and apply pagination
      const publicOutfits = data
        .filter(o => o.is_public)
        .slice(offset, offset + limit);
      return publicOutfits;
    } catch (error) {
      logger.error('Error fetching public outfits:', error);
      toast.error('Failed to load public outfits');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleOutfitPublic = useCallback(async (outfitId: string, isPublic: boolean) => {
    if (!user) return false;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/outfits/${outfitId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_public: isPublic }),
      });
      if (!response.ok) throw new Error(await response.text());

      toast.success(isPublic ? 'Outfit shared publicly!' : 'Outfit made private');
      return true;
    } catch (error) {
      logger.error('Error updating outfit privacy:', error);
      toast.error('Failed to update outfit privacy');
      return false;
    }
  }, [user]);

  // TODO: implement social features when Prisma models added for outfit_likes, outfit_ratings, outfit_comments

  const likeOutfit = useCallback(async (_outfitId: string) => {
    // TODO: implement when outfit_likes Prisma model is added
    return false;
  }, []);

  const unlikeOutfit = useCallback(async (_outfitId: string) => {
    // TODO: implement when outfit_likes Prisma model is added
    return false;
  }, []);

  const rateOutfit = useCallback(async (_outfitId: string, _rating: number) => {
    // TODO: implement when outfit_ratings Prisma model is added
    return false;
  }, []);

  const addComment = useCallback(async (_outfitId: string, _content: string) => {
    // TODO: implement when outfit_comments Prisma model is added
    return false;
  }, []);

  const fetchOutfitComments = useCallback(async (_outfitId: string) => {
    // TODO: implement when outfit_comments Prisma model is added
    const comments: any[] = [];
    return comments;
  }, []);

  return {
    loading,
    fetchPublicOutfits,
    toggleOutfitPublic,
    likeOutfit,
    unlikeOutfit,
    rateOutfit,
    addComment,
    fetchOutfitComments
  };
}
