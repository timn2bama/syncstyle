import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from "@/utils/logger";
import api from '@/lib/api';

interface UserData {
  profile: any;
  wardrobeItems: any[];
  outfits: any[];
  outfitItems: any[];
}

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
      // Fetch all user data in parallel
      const [profile, wardrobeItems, outfits] = await Promise.all([
        api.get('/profile').catch(() => null),
        api.get('/wardrobe').catch(() => []),
        api.get('/outfits').catch(() => []),
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
      // Fetch outfits and wardrobe items to get IDs for deletion
      const [outfits, wardrobeItems]: [any[], any[]] = await Promise.all([
        api.get('/outfits').catch(() => []),
        api.get('/wardrobe').catch(() => []),
      ]);

      // Delete outfits (cascade deletes outfit_items via Prisma)
      await Promise.all(
        outfits.map((o: any) => api.delete(`/outfits/${o.id}`))
      );

      // Delete wardrobe items
      await Promise.all(
        wardrobeItems.map((item: any) => api.delete(`/wardrobe/${item.id}`))
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
