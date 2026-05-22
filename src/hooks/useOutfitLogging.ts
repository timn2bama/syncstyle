import { useState, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeInput } from '@/lib/security';
import { logger } from "@/utils/logger";

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

  const getAuthHeaders = useCallback(async (json = false): Promise<Record<string, string>> => {
    const { data: sessionData } = await authClient.getSession();
    const token = sessionData?.session?.token;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }, []);

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

      const headers = await getAuthHeaders(true);

      // 1. Insert wear log via API
      const logRes = await fetch('/api/outfit-wear-log', {
        method: 'POST',
        headers,
        body: JSON.stringify({
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
        }),
      });

      if (!logRes.ok) throw new Error(await logRes.text());
      const wearLog = await logRes.json();

      // 2. Update wear counts on individual items
      if (logData.items_worn && logData.items_worn.length > 0) {
        for (const item of logData.items_worn) {
          const itemRes = await fetch(`/api/wardrobe/${item.item_id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              wear_count_increment: 1,
              last_worn: (sanitizedData.worn_date || new Date().toISOString()) as string,
            }),
          });
          if (!itemRes.ok) {
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
  }, [user, getAuthHeaders]);

  const deleteWearHistory = useCallback(async (historyId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/outfit-wear-log/${historyId}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) throw new Error(await res.text());
      toast.success('History entry deleted');
      return true;
    } catch (error: any) {
      toast.error('Failed to delete history');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  const getWearHistory = useCallback(async (days = 90) => {
    if (!user) return [];

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/outfit-wear-log?days=${days}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return await res.json() || [];
    } catch (error) {
      logger.error('Error fetching wear history:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  return { logOutfitWorn, deleteWearHistory, deleteLog: deleteWearHistory, getWearHistory, loading };
}
