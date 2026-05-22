import { authClient } from '@/lib/auth-client';
import type { PremiumFeature, SubscriptionTier, UpgradeModalData } from '@/types/premium';
import { logger } from "@/utils/logger";

// TODO: replace with GET /api/subscription-tiers when endpoint is created
// Hardcoded tier feature config (mostly static configuration data)
const HARDCODED_TIERS: Record<string, { features: PremiumFeature[]; limits: Record<string, any> }> = {
  free: {
    features: [],
    limits: { ai_recommendations_per_month: 5, photo_uploads_per_month: 3, outfit_generations_per_month: 3 },
  },
  Premium: {
    features: [
      'weather_integration',
      'marketplace_access',
      'advanced_analytics',
      'unlimited_wardrobe',
      'sustainability_tracking',
      'rental_marketplace',
    ],
    limits: { ai_recommendations_per_month: 50, photo_uploads_per_month: 100, outfit_generations_per_month: 50 },
  },
  Enterprise: {
    features: [
      'weather_integration',
      'marketplace_access',
      'advanced_analytics',
      'unlimited_wardrobe',
      'sustainability_tracking',
      'rental_marketplace',
      'ai_outfit_suggestions',
      'social_sharing',
      'personal_stylist',
      'team_collaboration',
    ],
    limits: { ai_recommendations_per_month: -1, photo_uploads_per_month: -1, outfit_generations_per_month: -1 },
  },
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: sessionData } = await authClient.getSession();
  if (!sessionData?.session) return {};
  return {
    'Authorization': `Bearer ${sessionData.session.token}`,
    'Content-Type': 'application/json',
  };
};

class PremiumFeatureGate {
  private featureMetadata: Record<PremiumFeature, { name: string; benefits: string[]; requiredTier: string }> = {
    ai_outfit_suggestions: {
      name: 'AI Outfit Suggestions',
      benefits: [
        'Get personalized outfit recommendations powered by AI',
        'Smart suggestions based on weather and occasion',
        'Learn your style preferences over time',
      ],
      requiredTier: 'pro',
    },
    weather_integration: {
      name: 'Weather Integration',
      benefits: [
        'See weather forecasts for your outfits',
        'Get suggestions based on temperature',
        'Plan outfits for upcoming trips',
      ],
      requiredTier: 'premium',
    },
    social_sharing: {
      name: 'Social Sharing',
      benefits: [
        'Share your outfits with the community',
        'Get feedback and likes from other users',
        'Discover trending styles',
      ],
      requiredTier: 'pro',
    },
    marketplace_access: {
      name: 'Marketplace Access',
      benefits: [
        'Buy and sell clothing items',
        'Access sustainable fashion marketplace',
        'Find unique pieces from other users',
      ],
      requiredTier: 'premium',
    },
    advanced_analytics: {
      name: 'Advanced Analytics',
      benefits: [
        'Track your wardrobe usage patterns',
        'See cost-per-wear analytics',
        'Identify underutilized items',
        'Get personalized insights',
      ],
      requiredTier: 'premium',
    },
    personal_stylist: {
      name: 'Personal Stylist',
      benefits: [
        'Schedule 1-on-1 consultations with professional stylists',
        'Get personalized style advice',
        'Wardrobe audit and recommendations',
      ],
      requiredTier: 'enterprise',
    },
    unlimited_wardrobe: {
      name: 'Unlimited Wardrobe Items',
      benefits: [
        'Add unlimited items to your wardrobe',
        'No storage limits',
        'Perfect for fashion enthusiasts',
      ],
      requiredTier: 'premium',
    },
    sustainability_tracking: {
      name: 'Sustainability Tracking',
      benefits: [
        'Track the carbon footprint of your wardrobe',
        'Get sustainability scores',
        'Make eco-conscious fashion choices',
      ],
      requiredTier: 'premium',
    },
    rental_marketplace: {
      name: 'Rental Marketplace',
      benefits: [
        'Rent designer pieces for special occasions',
        'List your items for rent',
        'Earn money from your wardrobe',
      ],
      requiredTier: 'premium',
    },
    team_collaboration: {
      name: 'Team Collaboration',
      benefits: [
        'Share wardrobes with team members',
        'Collaborative outfit planning',
        'Perfect for stylists and fashion teams',
      ],
      requiredTier: 'enterprise',
    },
  };

  private async getSubscription(): Promise<{ subscribed: boolean; subscription_tier: string | null; subscription_end: string | null }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/subscriptions/check', { method: 'POST', headers });
      if (!response.ok) return { subscribed: false, subscription_tier: null, subscription_end: null };
      return await response.json();
    } catch (error) {
      logger.error('Error fetching subscription:', error);
      return { subscribed: false, subscription_tier: null, subscription_end: null };
    }
  }

  async checkFeatureAccess(_userId: string, feature: PremiumFeature): Promise<boolean> {
    try {
      const subscription = await this.getSubscription();

      if (!subscription.subscribed) {
        return false;
      }

      // Check if subscription is still active
      if (subscription.subscription_end && new Date(subscription.subscription_end) < new Date()) {
        return false;
      }

      const tierName = subscription.subscription_tier || 'free';
      const tier = HARDCODED_TIERS[tierName] || HARDCODED_TIERS['free'];
      return tier.features.includes(feature);
    } catch (error) {
      logger.error('Error checking feature access:', error);
      return false;
    }
  }

  async checkUsageLimit(_userId: string, usageType: 'ai_recommendations' | 'photo_uploads' | 'outfit_generations'): Promise<{ allowed: boolean; remaining: number | null }> {
    try {
      const subscription = await this.getSubscription();

      const tierName = subscription.subscribed ? (subscription.subscription_tier || 'free') : 'free';
      const tier = HARDCODED_TIERS[tierName] || HARDCODED_TIERS['free'];
      const limits = tier.limits;
      const limit = limits[`${usageType}_per_month`];

      if (limit === -1) {
        return { allowed: true, remaining: null };
      }

      // TODO: replace with GET /api/usage-tracking when endpoint is created
      const usage = 0; // stub: usage_count always 0 until endpoint exists

      return {
        allowed: usage < limit,
        remaining: Math.max(0, limit - usage),
      };
    } catch (error) {
      logger.error('Error checking usage limit:', error);
      return { allowed: false, remaining: 0 };
    }
  }

  async getUpgradePromptData(_userId: string, feature: PremiumFeature): Promise<UpgradeModalData> {
    const metadata = this.featureMetadata[feature];

    const subscription = await this.getSubscription();
    const currentTier = subscription.subscription_tier || 'free';

    // Find the first tier that includes the requested feature
    const recommendedTierEntry = Object.entries(HARDCODED_TIERS).find(([, tierData]) =>
      tierData.features.includes(feature)
    );

    const recommendedTier = recommendedTierEntry
      ? ({
          tier_name: recommendedTierEntry[0],
          name: recommendedTierEntry[0],
          features: recommendedTierEntry[1].features,
          limits: recommendedTierEntry[1].limits,
          advanced_analytics: recommendedTierEntry[1].limits?.advanced_analytics || false,
          personal_stylist: recommendedTierEntry[1].limits?.personal_stylist || false,
        } as unknown as SubscriptionTier)
      : null;

    // TODO: implement proper trial eligibility check via API
    const trialAvailable = !subscription.subscribed;

    return {
      feature,
      featureName: metadata.name,
      benefits: metadata.benefits,
      currentTier,
      recommendedTier,
      trialAvailable,
    };
  }

  getFeatureBenefits(feature: PremiumFeature): string[] {
    return this.featureMetadata[feature]?.benefits || [];
  }
}

export const premiumFeatureGate = new PremiumFeatureGate();
