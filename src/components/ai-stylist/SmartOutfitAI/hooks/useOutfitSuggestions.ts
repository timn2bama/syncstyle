import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/utils/logger";

export interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string | null;
  photo_url: string | null;
  brand?: string | null;
}

export interface AISuggestion {
  id: string;
  name: string;
  items: WardrobeItem[];
  suggestedItems: string[];
  reason: string;
  styleNotes: string;
  occasion: string;
  weatherScore: number;
  aiGenerated: boolean;
}

export interface WeatherData {
  temperature: number;
  condition: string;
  feelsLike: number;
  humidity: number;
  location: string;
}

export const useOutfitSuggestions = (onOutfitCreated?: () => void) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const { user } = useAuth();

  const generateSuggestions = async (location: string, preferences: string) => {
    if (!location.trim()) {
      toast.error("Please enter your location");
      return;
    }

    logger.info('Starting Smart AI request...', { location, preferences, userId: user?.id });
    setLoading(true);
    
    try {
      const res = await fetch('/api/ai/smart-outfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: location.trim(), preferences: preferences.trim() })
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.error('Smart outfit API error:', errText);
        throw new Error(errText);
      }

      const data = await res.json();

      if (data.error) {
        if (data.error.includes('quota limits') || data.error.includes('temporarily unavailable')) {
          toast.error("AI styling is temporarily unavailable. Please try again later.");
          setWeather(data.weather);
          setSuggestions([]);
          return;
        }
        throw new Error(data.error);
      }

      if (data.success && data.message?.includes('test')) {
        toast.info("Smart AI is initializing. Please try again in a moment.");
        setSuggestions([]);
        return;
      }

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setWeather(data.weather);
        toast.success(`Generated ${data.suggestions.length} AI outfit suggestions!`);
      } else {
        toast.error(data.message || "No suggestions could be generated");
        setSuggestions([]);
      }
    } catch (error: any) {
      logger.error('Error in generateSuggestions:', error);
      toast.error(`Failed to generate outfit suggestions: ${error.message}`);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const saveOutfit = async (suggestion: AISuggestion) => {
    if (!user) return;

    setSaving(suggestion.id);
    try {
      const { data: outfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: user.id,
          name: suggestion.name,
          description: `${suggestion.reason}\n\nStyle Notes: ${suggestion.styleNotes}`,
          occasion: suggestion.occasion,
          season: getSeasonFromWeather(weather?.temperature || 70)
        })
        .select()
        .single();

      if (outfitError) throw outfitError;

      if (suggestion.items.length > 0) {
        const outfitItems = suggestion.items.map(item => ({
          outfit_id: outfit.id,
          wardrobe_item_id: item.id
        }));

        const { error: itemsError } = await supabase
          .from('outfit_items')
          .insert(outfitItems);

        if (itemsError) throw itemsError;
      }

      toast.success(`Saved "${suggestion.name}" to your outfits!`);
      onOutfitCreated?.();
    } catch (error) {
      logger.error('Error saving outfit:', error);
      toast.error('Failed to save outfit');
    } finally {
      setSaving(null);
    }
  };

  const getSeasonFromWeather = (temp: number): string => {
    if (temp >= 75) return 'summer';
    if (temp >= 60) return 'spring';
    if (temp >= 45) return 'fall';
    return 'winter';
  };

  return {
    loading,
    suggestions,
    weather,
    saving,
    generateSuggestions,
    saveOutfit
  };
};
