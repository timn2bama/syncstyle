import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Sparkles, Image } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/utils/logger";

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string | null;
  photo_url: string | null;
}

interface OutfitSuggestion {
  id: number;
  weather: string;
  outfit: string;
  items: string[];
  reason: string;
  wardrobeItems?: WardrobeItem[];
}

interface OutfitSuggestionsProps {
  weatherSuggestions: OutfitSuggestion[];
}

export const OutfitSuggestions = ({ weatherSuggestions }: OutfitSuggestionsProps) => {
  const [outfitName, setOutfitName] = useState("");
  const [outfitDescription, setOutfitDescription] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<OutfitSuggestion | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [suggestionsWithItems, setSuggestionsWithItems] = useState<OutfitSuggestion[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchWardrobeItems();
    }
  }, [user]);

  useEffect(() => {
    if (wardrobeItems.length > 0) {
      enhanceSuggestionsWithUserItems();
    }
  }, [weatherSuggestions, wardrobeItems]);

  const fetchWardrobeItems = async () => {
    if (!user) return;
    try {
      const { data: sessionData } = await authClient.getSession();
      const token = sessionData?.session?.token;
      const headers: Record<string, string> = token
        ? { 'Authorization': `Bearer ${token}` }
        : {};

      const res = await fetch('/api/wardrobe', { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setWardrobeItems(data || []);
    } catch (error) {
      logger.error('Error fetching wardrobe items:', error);
    }
  };

  const enhanceSuggestionsWithUserItems = () => {
    const enhanced = weatherSuggestions.map(suggestion => {
      const matchedItems = findMatchingWardrobeItems(suggestion.items);
      return {
        ...suggestion,
        wardrobeItems: matchedItems
      };
    });
    setSuggestionsWithItems(enhanced);
  };

  const findMatchingWardrobeItems = (suggestionItems: string[]): WardrobeItem[] => {
    const matched: WardrobeItem[] = [];
    
    suggestionItems.forEach(item => {
      const normalizedSuggestion = item.toLowerCase();
      const wardrobeItem = wardrobeItems.find(w => {
        const itemName = w.name.toLowerCase();
        const category = w.category.toLowerCase();
        
        // Check for category matches
        if (normalizedSuggestion.includes('shirt') && category.includes('shirt')) return true;
        if (normalizedSuggestion.includes('jacket') && (category.includes('jacket') || category.includes('coat'))) return true;
        if (normalizedSuggestion.includes('pants') && (category.includes('pants') || category.includes('jeans'))) return true;
        if (normalizedSuggestion.includes('shoes') && category.includes('shoes')) return true;
        if (normalizedSuggestion.includes('dress') && category.includes('dress')) return true;
        if (normalizedSuggestion.includes('sweater') && category.includes('sweater')) return true;
        if (normalizedSuggestion.includes('top') && (category.includes('top') || category.includes('blouse'))) return true;
        
        // Check for name matches
        return itemName.includes(normalizedSuggestion.split(' ')[0]) || 
               normalizedSuggestion.includes(itemName.split(' ')[0]);
      });
      
      if (wardrobeItem && !matched.find(m => m.id === wardrobeItem.id)) {
        matched.push(wardrobeItem);
      }
    });
    
    return matched;
  };

  const handleCreateOutfit = async () => {
    if (!selectedSuggestion || !user || !outfitName.trim()) return;

    setIsCreating(true);
    try {
      const { data: sessionData } = await authClient.getSession();
      const token = sessionData?.session?.token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };

      const items = selectedSuggestion.wardrobeItems?.map(item => item.id) || [];

      const res = await fetch('/api/outfits', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: outfitName,
          description: outfitDescription || `Weather-suggested outfit for ${selectedSuggestion.weather}`,
          occasion: 'weather-suggested',
          season: getSeasonFromTemp(selectedSuggestion.weather),
          items,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success(`Outfit "${outfitName}" created successfully!`);
      setDialogOpen(false);
      setOutfitName("");
      setOutfitDescription("");
      setSelectedSuggestion(null);
    } catch (error) {
      logger.error('Error creating outfit:', error);
      toast.error('Failed to create outfit');
    } finally {
      setIsCreating(false);
    }
  };

  const getSeasonFromTemp = (weather: string) => {
    const temp = parseInt(weather.match(/(\d+)°F/)?.[1] || "70");
    if (temp >= 80) return 'summer';
    if (temp >= 65) return 'spring';
    if (temp >= 50) return 'fall';
    return 'winter';
  };

  const openCreateDialog = (suggestion: OutfitSuggestion) => {
    setSelectedSuggestion(suggestion);
    setOutfitName(suggestion.outfit);
    setOutfitDescription(`AI-suggested outfit for ${suggestion.weather}. ${suggestion.reason}`);
    setDialogOpen(true);
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-fashion-gold" />
        Today's Outfit Suggestions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {suggestionsWithItems.map((suggestion) => (
          <Card key={suggestion.id} className="shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg">{suggestion.outfit}</CardTitle>
              <p className="text-sm text-muted-foreground">{suggestion.weather}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestion.wardrobeItems && suggestion.wardrobeItems.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Image className="h-4 w-4" />
                      Your Items
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {suggestion.wardrobeItems.slice(0, 4).map((item) => (
                        <div key={item.id} className="flex flex-col items-center bg-secondary/30 rounded p-2">
                          {item.photo_url ? (
                            <img 
                              src={item.photo_url} 
                              alt={item.name}
                              className="w-12 h-12 rounded object-cover mb-1"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-secondary/50 rounded flex items-center justify-center mb-1">
                              <Image className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs text-center">{item.name}</span>
                        </div>
                      ))}
                    </div>
                    {suggestion.wardrobeItems.length > 4 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        +{suggestion.wardrobeItems.length - 4} more items
                      </p>
                    )}
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Recommended Items</h4>
                  <div className="space-y-1">
                    {suggestion.items.map((item, index) => (
                      <div key={index} className="text-sm bg-secondary/50 rounded px-2 py-1">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground bg-accent/10 rounded p-3">
                  <strong>Why this works:</strong> {suggestion.reason}
                </div>

                <Button 
                  variant="gold" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={() => openCreateDialog(suggestion)}
                >
                  <Plus className="h-4 w-4" />
                  Create This Outfit
                  {suggestion.wardrobeItems && suggestion.wardrobeItems.length > 0 && (
                    <span className="text-xs ml-1">({suggestion.wardrobeItems.length} items)</span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-fashion-gold" />
              Create Weather Outfit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedSuggestion && (
              <div className="bg-secondary/20 rounded-lg p-4">
                <h4 className="font-medium text-primary mb-2">{selectedSuggestion.outfit}</h4>
                <p className="text-sm text-muted-foreground mb-3">{selectedSuggestion.weather}</p>
                <div className="space-y-1">
                  {selectedSuggestion.items.map((item, index) => (
                    <div key={index} className="text-sm bg-background/60 rounded px-2 py-1">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="outfit-name">Outfit Name</Label>
              <Input
                id="outfit-name"
                value={outfitName}
                onChange={(e) => setOutfitName(e.target.value)}
                placeholder="Enter outfit name..."
              />
            </div>

            <div>
              <Label htmlFor="outfit-description">Description (Optional)</Label>
              <Textarea
                id="outfit-description"
                value={outfitDescription}
                onChange={(e) => setOutfitDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="gold"
                onClick={handleCreateOutfit}
                disabled={!outfitName.trim() || isCreating}
                className="flex-1 gap-2"
              >
                <Plus className="h-4 w-4" />
                {isCreating ? 'Creating...' : 'Create Outfit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};