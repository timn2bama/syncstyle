import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from "@/utils/logger";
import api from '@/lib/api';

export interface StylePreferences {
  user_id: string;
  preferences: any;
  favorite_colors: string[];
  disliked_colors: string[];
  style_keywords: string[];
  created_at: string;
  updated_at: string;
}

export interface StyleFeedback {
  outfit_id: string;
  liked: boolean;
  rating?: number;
  occasion_match?: boolean;
  color_preference?: 'love' | 'like' | 'neutral' | 'dislike';
}

export function useStylePreferences() {
  const [preferences, setPreferences] = useState<StylePreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await api.get('/style-preferences');
      // API returns {} when no preferences exist
      setPreferences(Object.keys(data).length > 0 ? (data as StylePreferences) : null);
    } catch (error) {
      logger.error('Error fetching style preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updatePreferences = useCallback(async (updates: Partial<StylePreferences>) => {
    if (!user) return false;

    try {
      const data = await api.put('/style-preferences', updates);
      setPreferences(data as StylePreferences);
      toast.success('Style preferences updated!');
      return true;
    } catch (error) {
      logger.error('Error updating style preferences:', error);
      toast.error('Failed to update preferences');
      return false;
    }
  }, [user]);

  const recordStyleFeedback = useCallback(async (feedback: StyleFeedback) => {
    if (!user || !preferences) return;

    try {
      // Update preferences based on feedback
      const currentPrefs = preferences.preferences || {};
      const updatedPrefs = { ...currentPrefs };

      // Track outfit interaction patterns
      if (!updatedPrefs.outfit_interactions) {
        updatedPrefs.outfit_interactions = {};
      }

      updatedPrefs.outfit_interactions[feedback.outfit_id] = {
        liked: feedback.liked,
        rating: feedback.rating,
        occasion_match: feedback.occasion_match,
        color_preference: feedback.color_preference,
        timestamp: new Date().toISOString()
      };

      // Learn from color preferences
      if (feedback.color_preference) {
        const currentFavorites = preferences.favorite_colors || [];
        const currentDislikes = preferences.disliked_colors || [];

        const newFavorites = [...currentFavorites];
        const newDislikes = [...currentDislikes];

        // This would be enhanced with actual color extraction from outfits
        // For now, we'll use a simple learning mechanism
        if (feedback.color_preference === 'love' && feedback.liked) {
          // In a real implementation, we'd extract colors from the outfit
          // and add them to favorites
        } else if (feedback.color_preference === 'dislike') {
          // Similarly, add to dislikes
        }

        await updatePreferences({
          preferences: updatedPrefs,
          favorite_colors: newFavorites,
          disliked_colors: newDislikes
        });
      } else {
        await updatePreferences({
          preferences: updatedPrefs
        });
      }
    } catch (error) {
      logger.error('Error recording style feedback:', error);
    }
  }, [user, preferences, updatePreferences]);

  const getRecommendedColors = useCallback(() => {
    if (!preferences) return [];
    
    const favorites = preferences.favorite_colors || [];
    const dislikes = preferences.disliked_colors || [];
    
    // Filter out disliked colors and prioritize favorites
    const baseColors = [
      'black', 'white', 'navy', 'gray', 'beige', 'brown',
      'red', 'blue', 'green', 'yellow', 'purple', 'pink',
      'orange', 'teal', 'burgundy', 'cream'
    ];
    
    return baseColors
      .filter(color => !dislikes.includes(color))
      .sort((a, b) => {
        const aIsFavorite = favorites.includes(a);
        const bIsFavorite = favorites.includes(b);
        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;
        return 0;
      });
  }, [preferences]);

  const getStyleInsights = useCallback(() => {
    if (!preferences?.preferences?.outfit_interactions) {
      return {
        totalInteractions: 0,
        favoriteOccasions: [],
        topColors: [],
        styleEvolution: []
      };
    }

    const interactions = preferences.preferences.outfit_interactions;
    const totalInteractions = Object.keys(interactions).length;
    
    // Analyze favorite occasions (would need outfit data to be meaningful)
    const favoriteOccasions = preferences.style_keywords || [];
    
    // Top colors from favorites
    const topColors = preferences.favorite_colors?.slice(0, 5) || [];
    
    return {
      totalInteractions,
      favoriteOccasions,
      topColors,
      styleEvolution: [] // Could track changes over time
    };
  }, [preferences]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    fetchPreferences,
    updatePreferences,
    recordStyleFeedback,
    getRecommendedColors,
    getStyleInsights
  };
}