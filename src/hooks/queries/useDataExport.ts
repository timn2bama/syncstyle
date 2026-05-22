import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { logger } from "@/utils/logger";

interface UserData {
  profile: any;
  wardrobeItems: any[];
  outfits: any[];
  outfitItems: any[];
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: sessionData } = await authClient.getSession();
  if (!sessionData?.session) return {};
  return {
    'Authorization': `Bearer ${sessionData.session.token}`,
    'Content-Type': 'application/json',
  };
};

export function useDataExport() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const exportUserData = useCallback(async (): Promise<boolean> => {
    if (!user) {
      toast.error('You must be logged in to export data');
      return false;
    }

    setIsExporting(true);

    try {
      const headers = await getAuthHeaders();

      // Fetch all user data in parallel
      const [profileResponse, wardrobeResponse, outfitsResponse] = await Promise.all([
        fetch('/api/profile', { headers }),
        fetch('/api/wardrobe', { headers }),
        fetch('/api/outfits', { headers }),
      ]);

      const [profile, wardrobeItems, outfits] = await Promise.all([
        profileResponse.ok ? profileResponse.json() : null,
        wardrobeResponse.ok ? wardrobeResponse.json() : [],
        outfitsResponse.ok ? outfitsResponse.json() : [],
      ]);

      // outfit_items are already nested inside each outfit as `items`
      const outfitItems = (outfits as any[]).flatMap((o: any) => o.items || []);

      const userData: UserData = {
        profile,
        wardrobeItems: wardrobeItems || [],
        outfits: outfits || [],
        outfitItems,
      };

      // Create downloadable JSON file
      const dataBlob = new Blob([JSON.stringify(userData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `syncstyle-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Your data has been exported successfully');
      return true;
    } catch (error) {
      logger.error('Failed to export data:', error);
      toast.error('Failed to export data. Please try again.');
      return false;
    } finally {
      setIsExporting(false);
    }
  }, [user]);

  const deleteAllUserData = useCallback(async (): Promise<boolean> => {
    if (!user) {
      toast.error('You must be logged in to delete data');
      return false;
    }

    try {
      const headers = await getAuthHeaders();

      // Fetch outfits and wardrobe items to get IDs for deletion
      const [outfitsResponse, wardrobeResponse] = await Promise.all([
        fetch('/api/outfits', { headers }),
        fetch('/api/wardrobe', { headers }),
      ]);

      const outfits: any[] = outfitsResponse.ok ? await outfitsResponse.json() : [];
      const wardrobeItems: any[] = wardrobeResponse.ok ? await wardrobeResponse.json() : [];

      // Delete outfits (cascade deletes outfit_items via Prisma)
      await Promise.all(
        outfits.map((o: any) =>
          fetch(`/api/outfits/${o.id}`, { method: 'DELETE', headers })
        )
      );

      // Delete wardrobe items
      await Promise.all(
        wardrobeItems.map((item: any) =>
          fetch(`/api/wardrobe/${item.id}`, { method: 'DELETE', headers })
        )
      );

      toast.success('All your data has been permanently deleted');
      return true;
    } catch (error) {
      logger.error('Failed to delete user data:', error);
      toast.error('Failed to delete data. Please contact support.');
      return false;
    }
  }, [user]);

  return {
    exportUserData,
    deleteAllUserData,
    isExporting
  };
}
