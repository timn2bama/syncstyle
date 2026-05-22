import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from "@/utils/logger";
import api from '@/lib/api';

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

export function useSocialOutfits() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchPublicOutfits = useCallback(async (limit = 20, offset = 0) => {
    setLoading(true);
    try {
      const data: SocialOutfit[] = await api.get('/outfits');
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
      await api.put(`/outfits/${outfitId}`, { is_public: isPublic });
      toast.success(isPublic ? 'Outfit shared publicly!' : 'Outfit made private');
      return true;
    } catch (error) {
      logger.error('Error updating outfit privacy:', error);
      toast.error('Failed to update outfit privacy');
      return false;
    }
  }, [user]);

  const likeOutfit = useCallback(async (outfitId: string) => {
    if (!user) return false;
    try {
      await api.post('/social/outfits', { action: 'like', outfit_id: outfitId });
      return true;
    } catch (error) {
      logger.error('Error liking outfit:', error);
      return false;
    }
  }, [user]);

  const unlikeOutfit = useCallback(async (outfitId: string) => {
    if (!user) return false;
    try {
      await api.post('/social/outfits', { action: 'unlike', outfit_id: outfitId });
      return true;
    } catch (error) {
      logger.error('Error unliking outfit:', error);
      return false;
    }
  }, [user]);

  const rateOutfit = useCallback(async (outfitId: string, rating: number) => {
    if (!user) return false;
    try {
      await api.post('/social/outfits', { action: 'rate', outfit_id: outfitId, rating });
      return true;
    } catch (error) {
      logger.error('Error rating outfit:', error);
      return false;
    }
  }, [user]);

  const addComment = useCallback(async (outfitId: string, content: string) => {
    if (!user) return false;
    try {
      await api.post('/social/outfits', { action: 'comment', outfit_id: outfitId, content });
      return true;
    } catch (error) {
      logger.error('Error adding comment:', error);
      return false;
    }
  }, [user]);

  const fetchOutfitComments = useCallback(async (outfitId: string) => {
    try {
      const data: any = await api.get(`/social/outfits?outfit_id=${outfitId}`);
      return data.comments ?? [];
    } catch (error) {
      logger.error('Error fetching outfit comments:', error);
      return [];
    }
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
