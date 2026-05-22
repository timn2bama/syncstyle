import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useToast } from '@/hooks/use-toast';
import { logger } from "@/utils/logger";

interface SavedService {
  id: string;
  user_id: string;
  service_name: string;
  service_address: string;
  service_phone: string | null;
  service_data: any;
  created_at: string;
  updated_at: string;
}

export const useSavedServices = () => {
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // TODO: implement saved services API endpoint (GET/POST/DELETE /api/services/saved)
  // when the route exists, replace these stubs with actual fetch calls

  // Fetch saved services for the current user
  const fetchSavedServices = async () => {
    // TODO: replace with GET /api/services/saved once endpoint is created
    setLoading(true);
    try {
      setSavedServices([]);
    } catch (error: any) {
      logger.error('Error fetching saved services:', error);
      toast({
        title: "Error",
        description: "Failed to load saved services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Save a service
  const saveService = async (service: any) => {
    // TODO: replace with POST /api/services/saved once endpoint is created
    try {
      const { data: sessionData } = await authClient.getSession();
      if (!sessionData?.session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to save services",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Service Saved",
        description: `${service.name} has been added to your saved services`,
      });

      await fetchSavedServices();
      return true;
    } catch (error: any) {
      logger.error('Error saving service:', error);
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
      return false;
    }
  };

  // Remove a saved service
  const removeSavedService = async (serviceName: string, serviceAddress: string) => {
    // TODO: replace with DELETE /api/services/saved once endpoint is created
    try {
      const { data: sessionData } = await authClient.getSession();
      if (!sessionData?.session) return false;

      toast({
        title: "Service Removed",
        description: "Service has been removed from your saved list",
      });

      await fetchSavedServices();
      return true;
    } catch (error: any) {
      logger.error('Error removing saved service:', error);
      toast({
        title: "Error",
        description: "Failed to remove service",
        variant: "destructive",
      });
      return false;
    }
  };

  // Check if a service is saved
  const isServiceSaved = (serviceName: string, serviceAddress: string) => {
    return savedServices.some(
      saved => saved.service_name === serviceName &&
                saved.service_address === (serviceAddress || '')
    );
  };

  // Toggle save status
  const toggleSaveService = async (service: any) => {
    const address = service.vicinity || service.formatted_address || '';
    const isSaved = isServiceSaved(service.name, address);

    if (isSaved) {
      return await removeSavedService(service.name, address);
    } else {
      return await saveService(service);
    }
  };

  useEffect(() => {
    fetchSavedServices();
  }, []);

  return {
    savedServices,
    loading,
    saveService,
    removeSavedService,
    isServiceSaved,
    toggleSaveService,
    fetchSavedServices
  };
};
