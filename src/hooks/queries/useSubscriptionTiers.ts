import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from "@/utils/logger";

interface SubscriptionTier {
  id: string;
  tier_name: string;
  price_monthly: number;
  price_yearly: number;
  features: any;
  limits: any;
  is_active: boolean;
}

interface UsageStats {
  ai_recommendations: number;
  photo_uploads: number;
  outfit_generations: number;
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: sessionData } = await authClient.getSession();
  if (!sessionData?.session) return {};
  return {
    'Authorization': `Bearer ${sessionData.session.token}`,
    'Content-Type': 'application/json',
  };
};

export const useSubscriptionTiers = () => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    ai_recommendations: 0,
    photo_uploads: 0,
    outfit_generations: 0
  });
  const [loading, setLoading] = useState(true);
  const { user, subscriptionStatus } = useAuth();

  const fetchTiers = async () => {
    // Subscription tiers are static config — use hardcoded defaults
    // until a dedicated /api/subscription-tiers endpoint is available.
    const staticTiers: SubscriptionTier[] = [
      {
        id: 'free',
        tier_name: 'Free',
        price_monthly: 0,
        price_yearly: 0,
        features: {},
        limits: {
          ai_recommendations_per_month: 5,
          photo_uploads_per_month: 20,
          outfit_generations_per_month: 10,
        },
        is_active: true,
      },
      {
        id: 'premium',
        tier_name: 'Premium',
        price_monthly: 9.99,
        price_yearly: 99.99,
        features: {},
        limits: {
          ai_recommendations_per_month: -1,
          photo_uploads_per_month: -1,
          outfit_generations_per_month: -1,
        },
        is_active: true,
      },
    ];

    setTiers(staticTiers);

    if (subscriptionStatus.subscribed && subscriptionStatus.subscription_tier) {
      const tierName = subscriptionStatus.subscription_tier;
      const current = staticTiers.find(
        (tier) => tier.tier_name.toLowerCase() === tierName.toLowerCase()
      );
      setCurrentTier(current || null);
    } else {
      const freeTier = staticTiers.find((tier) => tier.tier_name.toLowerCase() === 'free');
      setCurrentTier(freeTier || null);
    }
  };

  const fetchUsageStats = async () => {
    if (!user) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/subscriptions', { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription data');
      }

      const data = await response.json();
      const usageRecords: Array<{ usage_type: string; usage_count: number }> = data.usage || [];

      const stats = usageRecords.reduce(
        (acc, item) => {
          const usageType = item.usage_type as keyof UsageStats;
          const count = item.usage_count || 0;
          acc[usageType] = (acc[usageType] || 0) + count;
          return acc;
        },
        {
          ai_recommendations: 0,
          photo_uploads: 0,
          outfit_generations: 0,
        } as UsageStats
      );

      setUsageStats(stats);
    } catch (error) {
      logger.error('Error fetching usage stats:', error);
    }
  };

  const trackUsage = async (usageType: keyof UsageStats, count = 1) => {
    if (!user) return;

    try {
      const headers = await getAuthHeaders();
      await fetch('/api/subscriptions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ usage_type: usageType, count }),
      });
      fetchUsageStats();
    } catch (error) {
      logger.error('Error tracking usage:', error);
    }
  };

  const getRemainingUsage = (usageType: keyof UsageStats) => {
    if (!currentTier || !currentTier.limits) return 0;
    const limit = currentTier.limits[`${usageType}_per_month`] || 0;
    if (limit === -1) return Infinity;
    const used = usageStats[usageType] || 0;
    return Math.max(0, limit - used);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTiers(), fetchUsageStats()]);
      setLoading(false);
    };
    init();
  }, [user, subscriptionStatus]);

  return {
    tiers,
    currentTier,
    usageStats,
    loading,
    trackUsage,
    getRemainingUsage,
    refreshTiers: fetchTiers,
    refreshUsage: fetchUsageStats
  };
};
