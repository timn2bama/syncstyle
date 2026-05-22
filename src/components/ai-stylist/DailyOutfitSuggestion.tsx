import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { authClient } from '@/lib/auth-client';
import { Heart, ThumbsUp, ThumbsDown, Meh, Star, Calendar, Cloud, Loader2 } from 'lucide-react';
import { useOutfitLogging } from '@/hooks/useOutfitLogging';
import { logger } from "@/utils/logger";
import type { DailyOutfitSuggestion as DailyOutfitSuggestionData, OutfitItem } from '@/types/ai';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: sessionData } = await authClient.getSession();
  if (!sessionData?.session) return {};
  return {
    'Authorization': `Bearer ${sessionData.session.token}`,
    'Content-Type': 'application/json',
  };
};

interface DailyOutfitSuggestionProps {
  suggestions: DailyOutfitSuggestionData[];
  onRefresh: () => void;
}

const DailyOutfitSuggestion: React.FC<DailyOutfitSuggestionProps> = ({
  suggestions,
  onRefresh,
}) => {
  const { toast } = useToast();
  const { logOutfitWorn } = useOutfitLogging();
  const [loading, setLoading] = useState(false);

  const handleFeedback = async (suggestionId: string, feedback: string) => {
    try {
      setLoading(true);

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/daily-outfit?id=${suggestionId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ user_feedback: feedback }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record feedback');
      }

      toast({
        title: "Feedback Recorded",
        description: "Your feedback helps improve future suggestions!",
      });

      onRefresh();
    } catch (error) {
      logger.error('Error recording feedback:', error);
      toast({
        title: "Error",
        description: "Failed to record feedback",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsWorn = async (suggestion: DailyOutfitSuggestionData) => {
    try {
      setLoading(true);

      // Extract items from outfit_data
      const items_worn = suggestion.outfit_data?.items?.map((item: OutfitItem) => ({
        item_id: item.id,
        name: item.name,
        category: item.category,
        color: item.color,
        brand: item.brand,
      })) || [];

      // Create wear log with weather context
      // Note: suggestion.id is the daily suggestion id, not necessarily a saved outfit id
      // If we don't have a saved outfit id, we can pass a dummy or handled it in the hook
      await logOutfitWorn('ai-suggestion', {
        items_worn,
        occasion: suggestion.occasion,
        weather_temp: suggestion.weather_context?.temperature,
        weather_condition: suggestion.weather_context?.condition,
        style_satisfaction: 4,
        notes: `AI-suggested outfit from ${suggestion.suggestion_date}`,
      });

      // Mark suggestion as worn
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/daily-outfit?id=${suggestion.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ was_worn: true }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to mark outfit as worn');
      }

      toast({
        title: "Outfit Logged & Marked as Worn",
        description: "Great choice! This helps us learn your preferences.",
      });

      onRefresh();
    } catch (error) {
      logger.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to mark outfit as worn",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (suggestions.length === 0) {
    return (
      <Card className="bg-secondary/10 border-dashed border-2">
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold">No daily suggestions yet</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Click "Generate Daily Outfit" above to get your first AI-powered style recommendation based on today's weather!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {suggestions.map((suggestion) => (
        <Card key={suggestion.id} className="overflow-hidden shadow-card hover:shadow-elegant transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* Header/Reasoning Section */}
            <div className="p-6 bg-secondary/20 lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{new Date(suggestion.suggestion_date).toLocaleDateString()}</span>
                </div>
                {suggestion.was_worn && (
                  <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">
                    WORN
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    <Star className="h-4 w-4 text-fashion-gold fill-fashion-gold" />
                    AI Reasoning
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    "{suggestion.ai_reasoning || "Perfect for today's style needs."}"
                  </p>
                </div>

                {suggestion.weather_context && (
                  <div className="bg-background/60 p-3 rounded-lg border border-primary/10">
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <Cloud className="h-4 w-4 text-blue-500" />
                      Weather Context
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.weather_context.temperature}°F, {suggestion.weather_context.condition}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="elegant" 
                    onClick={() => markAsWorn(suggestion)}
                    disabled={loading || suggestion.was_worn}
                    className="w-full"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4 mr-2" />}
                    {suggestion.was_worn ? 'Marked as Worn' : 'Mark as Worn Today'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Outfit Visualization Section */}
            <div className="p-6 lg:col-span-2">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold capitalize">{suggestion.occasion || 'Everyday'} Look</h3>
                  <p className="text-sm text-muted-foreground">AI Curated from your wardrobe</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={suggestion.user_feedback === 'like' ? 'bg-primary/10' : ''}
                    onClick={() => handleFeedback(suggestion.id, 'like')}
                  >
                    <ThumbsUp className={`h-4 w-4 ${suggestion.user_feedback === 'like' ? 'text-primary fill-primary' : ''}`} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className={suggestion.user_feedback === 'meh' ? 'bg-orange-50' : ''}
                    onClick={() => handleFeedback(suggestion.id, 'meh')}
                  >
                    <Meh className={`h-4 w-4 ${suggestion.user_feedback === 'meh' ? 'text-orange-500 fill-orange-500' : ''}`} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className={suggestion.user_feedback === 'dislike' ? 'bg-destructive/10' : ''}
                    onClick={() => handleFeedback(suggestion.id, 'dislike')}
                  >
                    <ThumbsDown className={`h-4 w-4 ${suggestion.user_feedback === 'dislike' ? 'text-destructive fill-destructive' : ''}`} />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {suggestion.outfit_data?.items?.map((item: OutfitItem, idx: number) => (
                  <div key={idx} className="bg-secondary/10 rounded-xl p-3 border border-transparent hover:border-primary/20 transition-all text-center">
                    <div className="aspect-square bg-background rounded-lg mb-2 flex items-center justify-center text-2xl shadow-sm overflow-hidden">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>👕</span>
                      )}
                    </div>
                    <p className="text-xs font-bold truncate">{item.name}</p>
                    <Badge variant="outline" className="text-[9px] mt-1 scale-90">{item.category}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default DailyOutfitSuggestion;
