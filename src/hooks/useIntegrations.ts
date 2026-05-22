import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from "@/utils/logger";

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: sessionData } = await authClient.getSession();
  if (!sessionData?.session) return {};
  return {
    'Authorization': `Bearer ${sessionData.session.token}`,
    'Content-Type': 'application/json',
  };
};

interface Integration {
  id: string;
  integration_type: string;
  settings: any;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: string; // work, formal, casual, etc.
}

export const useIntegrations = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchIntegrations = async () => {
    if (!user) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/integrations', { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setIntegrations(data || []);
    } catch (error) {
      logger.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateIntegration = async (
    integrationType: string,
    settings: Record<string, any>,
    isActive = true
  ) => {
    if (!user) return;

    try {
      const headers = await getAuthHeaders();
      const existing = integrations.find(i => i.integration_type === integrationType);

      if (existing) {
        const response = await fetch('/api/integrations', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ integration_type: integrationType, settings, is_active: isActive }),
        });
        if (!response.ok) throw new Error(await response.text());
      } else {
        const response = await fetch('/api/integrations', {
          method: 'POST',
          headers,
          body: JSON.stringify({ integration_type: integrationType, settings }),
        });
        if (!response.ok) throw new Error(await response.text());
      }

      fetchIntegrations(); // Refresh data
    } catch (error) {
      logger.error('Error updating integration:', error);
      throw error;
    }
  };

  const getIntegration = (type: string): Integration | null => {
    return integrations.find(i => i.integration_type === type && i.is_active) || null;
  };

  // Weather integration
  const getWeatherRecommendations = async (location: string) => {
    try {
      const res = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location })
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (error) {
      logger.error('Error getting weather recommendations:', error);
      return null;
    }
  };

  // Calendar integration simulation
  const getUpcomingEvents = (): CalendarEvent[] => {
    const calendarIntegration = getIntegration('calendar');
    if (!calendarIntegration) return [];

    // Mock calendar events - in real implementation, this would sync with actual calendar APIs
    const now = new Date();
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Business Meeting',
        date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        type: 'formal'
      },
      {
        id: '2',
        title: 'Casual Lunch',
        date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'casual'
      },
      {
        id: '3',
        title: 'Date Night',
        date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'elegant'
      }
    ];

    return mockEvents;
  };

  // Social media sharing
  const shareOutfit = async (outfitData: any, platforms: string[]) => {
    const socialIntegration = getIntegration('social_media');
    if (!socialIntegration) return false;

    try {
      // Mock sharing - in real implementation, this would use actual social media APIs
      logger.info('Sharing outfit to platforms:', platforms, outfitData);
      
      // Here you would implement actual sharing logic for each platform
      // For now, we'll just simulate it
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      logger.error('Error sharing outfit:', error);
      return false;
    }
  };

  // Shopping platform integration
  const findSimilarItems = async (_itemDescription: string, category: string) => {
    try {
      // Mock shopping recommendations - in real implementation, 
      // this would integrate with Amazon Product Advertising API, etc.
      const mockItems = [
        {
          title: `Similar ${category} - Style Match`,
          price: '$49.99',
          url: 'https://example.com/item1',
          image: 'https://via.placeholder.com/150',
          platform: 'Amazon'
        },
        {
          title: `${category} Alternative - Great Quality`,
          price: '$39.99',
          url: 'https://example.com/item2',
          image: 'https://via.placeholder.com/150',
          platform: 'Nordstrom'
        }
      ];

      return mockItems;
    } catch (error) {
      logger.error('Error finding similar items:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [user]);

  return {
    integrations,
    loading,
    updateIntegration,
    getIntegration,
    getWeatherRecommendations,
    getUpcomingEvents,
    shareOutfit,
    findSimilarItems,
    refreshIntegrations: fetchIntegrations
  };
};