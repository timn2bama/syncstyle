import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeInput } from '@/lib/security';
import { logger } from "@/utils/logger";
import api from '@/lib/api';

export interface OutfitWearLog {
  outfit_id?: string;
  items_worn?: Array<{
    item_id: string;
    name: string;
    category: string;
    color?: string;
    brand?: string;
  }>;
  worn_date?: string | Date;
  location?: string;
  weather_temp?: number;
  weather_condition?: string;
  occasion?: string;
  mood_tags?: string[];
  comfort_rating?: number;
  style_satisfaction?: number;
  would_wear_again?: boolean;
  notes?: string;
}

export function useOutfitLogging() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const logOutfitWorn = useCallback(async (outfitId: string, logData: Partial<OutfitWearLog>) => {
    if (!user) {
      toast.error('Please sign in to log outfits');
      return false;
    }

    setLoading(true);
    try {
      // Sanitize all user inputs before storage
      const sanitizedData = {
        ...logData,
        notes: logData.notes ? sanitizeInput(logData.notes) : undefined,
        location: logData.location ? sanitizeInput(logData.location) : undefined,
        occasion: logData.occasion ? sanitizeInput(logData.occasion) : undefined,
        weather_condition: logData.weather_condition ? sanitizeInput(logData.weather_condition) : undefined,
      };

      // 1. Insert wear log via API
      await api.post('/outfit-wear-log', {
        outfit_id: outfitId,
        worn_date: sanitizedData.worn_date || new Date().toISOString(),
        location: sanitizedData.location,
        weather_condition: sanitizedData.weather_condition,
        weather_temp: sanitizedData.weather_temp,
        occasion: sanitizedData.occasion,
        mood_tags: sanitizedData.mood_tags,
        comfort_rating: sanitizedData.comfort_rating,
        style_satisfaction: sanitizedData.style_satisfaction,
        notes: sanitizedData.notes,
      });

      // 2. Update wear counts on individual items
      if (logData.items_worn && logData.items_worn.length > 0) {
        for (const item of logData.items_worn) {
          try {
            await api.put(`/wardrobe/${item.item_id}`, {
              wear_count_increment: 1,
              last_worn: (sanitizedData.worn_date || new Date().toISOString()) as string,
            });
          } catch {
            logger.error('Error updating wear count for item:', item.item_id);
          }
        }
      }

      toast.success('Outfit wear history logged successfully!');
      return true;
    } catch (error: any) {
      logger.error('Error logging outfit wear:', error);
      toast.error(`Failed to log history: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const deleteWearHistory = useCallback(async (historyId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      await api.delete(`/outfit-wear-log/${historyId}`);
      toast.success('History entry deleted');
      return true;
    } catch (error: any) {
      toast.error('Failed to delete history');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getWearHistory = useCallback(async (days = 90) => {
    if (!user) return [];

    setLoading(true);
    try {
      return await api.get(`/outfit-wear-log?days=${days}`) || [];
    } catch (error) {
      logger.error('Error fetching wear history:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { logOutfitWorn, deleteWearHistory, deleteLog: deleteWearHistory, getWearHistory, loading };
}
