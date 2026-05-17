import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, Calendar, TrendingUp, ShoppingBag, Heart, Star } from 'lucide-react';
import DailyOutfitSuggestion from './DailyOutfitSuggestion';
import { logger } from "@/utils/logger";
import type { DailyOutfitSuggestion as DailyOutfitSuggestionType, EventOutfitRequest, StyleEvolution } from '@/types/ai';

const AIStylistDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('daily');
  const [outfitSuggestions, setOutfitSuggestions] = useState<DailyOutfitSuggestionType[]>([]);
  const [eventRequests, setEventRequests] = useState<EventOutfitRequest[]>([]);
  const [styleEvolution, setStyleEvolution] = useState<StyleEvolution[]>([]);

  useEffect(() => {
    if (user) {
      fetchStylistData();
    }
  }, [user]);

  const fetchStylistData = async () => {
    if (!user) return;

    try {
      // Fetch daily outfit suggestions
      const { data: suggestionsData, error: suggestionsError } = await supabase
        .from('daily_outfit_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .order('suggestion_date', { ascending: false })
        .limit(10);

      if (suggestionsError) throw suggestionsError;
      setOutfitSuggestions((suggestionsData as DailyOutfitSuggestionType[]) || []);

      // Fetch event outfit requests
      const { data: eventsData, error: eventsError } = await supabase
        .from('event_outfit_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: false });

      if (eventsError) throw eventsError;
      setEventRequests((eventsData as EventOutfitRequest[]) || []);

      // Fetch style evolution data
      const { data: evolutionData, error: evolutionError } = await supabase
        .from('style_evolution_tracking')
        .select('*')
        .eq('user_id', user.id)
        .order('tracking_date', { ascending: false })
        .limit(30);

      if (evolutionError) throw evolutionError;
      setStyleEvolution((evolutionData as StyleEvolution[]) || []);

    } catch (error) {
      logger.error('Error fetching stylist data:', error);
      toast({
        title: "Error",
        description: "Failed to load AI stylist data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDailyOutfit = async () => {
    try {
      setLoading(true);
      
      const res = await fetch('/api/ai/daily-stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id })
      });
      if (!res.ok) throw new Error(await res.text());

      toast({
        title: "Success",
        description: "New daily outfit suggestion generated!",
      });

      fetchStylistData();
    } catch (error) {
      logger.error('Error generating daily outfit:', error);
      toast({
        title: "Error",
        description: "Failed to generate outfit suggestion",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceAverage = () => {
    if (styleEvolution.length === 0) return 0;
    return styleEvolution.reduce((sum, item) => sum + (item.confidence_level || 0), 0) / styleEvolution.length;
  };

  const getRecentFeedback = () => {
    const recentSuggestions = outfitSuggestions.slice(0, 5);
    const feedbackCounts = recentSuggestions.reduce((acc, suggestion) => {
      if (suggestion.user_feedback) {
        acc[suggestion.user_feedback] = (acc[suggestion.user_feedback] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return feedbackCounts;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading AI stylist dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">AI Personal Stylist</h1>
            <p className="text-muted-foreground">Your personalized fashion assistant powered by AI</p>
          </div>
          
          <Button onClick={generateDailyOutfit} disabled={loading}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Daily Outfit
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Suggestions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{outfitSuggestions.length}</div>
              <p className="text-xs text-muted-foreground">
                Total outfit suggestions received
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Style Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getConfidenceAverage().toFixed(1)}/10</div>
              <p className="text-xs text-muted-foreground">
                Average confidence level
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Event Requests</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{eventRequests.length}</div>
              <p className="text-xs text-muted-foreground">
                Special occasion outfits planned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outfits Worn</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {outfitSuggestions.filter(s => s.was_worn).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Suggestions you actually wore
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button 
            variant={activeTab === 'daily' ? 'default' : 'outline'}
            onClick={() => setActiveTab('daily')}
          >
            Daily Outfits
          </Button>
          <Button 
            variant={activeTab === 'events' ? 'default' : 'outline'}
            onClick={() => setActiveTab('events')}
          >
            Event Planning
          </Button>
          <Button 
            variant={activeTab === 'evolution' ? 'default' : 'outline'}
            onClick={() => setActiveTab('evolution')}
          >
            Style Evolution
          </Button>
          <Button 
            variant={activeTab === 'shopping' ? 'default' : 'outline'}
            onClick={() => setActiveTab('shopping')}
          >
            Personal Shopping
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'daily' && (
          <DailyOutfitSuggestion 
            suggestions={outfitSuggestions}
            onRefresh={fetchStylistData}
          />
        )}

        {activeTab === 'events' && (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p>Event planning features coming soon!</p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'evolution' && (
          <Card>
            <CardContent className="py-8 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p>Style evolution tracking coming soon!</p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'shopping' && (
          <Card>
            <CardContent className="py-8 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p>Personal shopping assistant coming soon!</p>
            </CardContent>
          </Card>
        )}

        {/* Recent Feedback Summary */}
        {Object.keys(getRecentFeedback()).length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Recent Feedback Summary</CardTitle>
              <CardDescription>
                How you've been rating the AI suggestions lately
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(getRecentFeedback()).map(([feedback, count]) => (
                  <Badge key={feedback} variant="outline" className="capitalize">
                    {feedback}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AIStylistDashboard;