// Copyright (c) 2025 Tim N. (timn2bama)
// Licensed under the Apache License, Version 2.0.
// See the LICENSE file in the project root for license information.
import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/utils/logger";
import api from '@/lib/api';

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string | null;
  photo_url: string | null;
}

interface OutfitSuggestion {
  id: string;
  items: WardrobeItem[];
  occasion: string;
  season: string;
  matchScore: number;
  description: string;
}

export const useOutfitRecommendations = () => {
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const generateOutfitCombinations = useCallback((
    items: WardrobeItem[], 
    baseItem?: WardrobeItem
  ): OutfitSuggestion[] => {
    const suggestions: OutfitSuggestion[] = [];
    
    // Group items by category
    const itemsByCategory = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WardrobeItem[]>);

    // Define outfit templates
    const outfitTemplates = [
      {
        name: 'Business Casual',
        categories: ['tops', 'bottoms', 'shoes'],
        occasion: 'work',
        season: 'all seasons',
        description: 'Professional yet comfortable for the office'
      },
      {
        name: 'Weekend Casual',
        categories: ['tops', 'bottoms', 'shoes'],
        occasion: 'casual',
        season: 'all seasons',
        description: 'Relaxed and comfortable for weekend activities'
      },
      {
        name: 'Evening Out',
        categories: ['dresses', 'shoes'],
        occasion: 'date night',
        season: 'all seasons',
        description: 'Elegant look for dinner or entertainment'
      },
      {
        name: 'Layered Look',
        categories: ['tops', 'outerwear', 'bottoms', 'shoes'],
        occasion: 'casual',
        season: 'fall',
        description: 'Perfect for transitional weather'
      }
    ];

    // Generate combinations based on templates
    outfitTemplates.forEach((template, index) => {
      const outfitItems: WardrobeItem[] = [];
      let matchScore = 100;

      // If we have a base item, start with that
      if (baseItem) {
        outfitItems.push(baseItem);
        // Reduce match score if base item doesn't fit template
        if (!template.categories.includes(baseItem.category)) {
          matchScore -= 20;
        }
      }

      // Fill remaining categories
      template.categories.forEach(category => {
        const categoryItems = itemsByCategory[category] || [];
        
        // Skip if we already have an item from this category (from base item)
        if (baseItem && baseItem.category === category) return;

        if (categoryItems.length > 0) {
          // Simple selection: pick first available item
          const selectedItem = categoryItems[Math.floor(Math.random() * categoryItems.length)];
          outfitItems.push(selectedItem);
        } else {
          // Reduce score if we can't find items for this category
          matchScore -= 30;
        }
      });

      // Only add suggestion if we have at least 2 items and decent match score
      if (outfitItems.length >= 2 && matchScore >= 50) {
        suggestions.push({
          id: `suggestion-${index}`,
          items: outfitItems,
          occasion: template.occasion,
          season: template.season,
          matchScore,
          description: template.description
        });
      }
    });

    // Sort by match score
    return suggestions.sort((a, b) => b.matchScore - a.matchScore).slice(0, 6);
  }, []);

  const generateSuggestions = useCallback(async (baseItem?: WardrobeItem) => {
    if (!user) return;

    setLoading(true);
    try {
      const wardrobeItems = await api.get('/wardrobe');

      // Simple outfit recommendation algorithm
      const outfitSuggestions = generateOutfitCombinations(wardrobeItems, baseItem);
      setSuggestions(outfitSuggestions);
    } catch (error) {
      logger.error('Error generating outfit suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, generateOutfitCombinations]);

  const createOutfitFromSuggestion = useCallback(async (suggestion: OutfitSuggestion, name: string) => {
    if (!user) return;

    try {
      return await api.post('/outfits', {
        name,
        description: suggestion.description,
        occasion: suggestion.occasion,
        season: suggestion.season,
        items: suggestion.items.map(item => item.id),
      });
    } catch (error) {
      logger.error('Error creating outfit from suggestion:', error);
      throw error;
    }
  }, [user]);

  return {
    suggestions,
    loading,
    generateSuggestions,
    createOutfitFromSuggestion
  };
};