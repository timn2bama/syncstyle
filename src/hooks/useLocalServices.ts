import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface LocalService {
  id: string;
  name: string;
  type: string;
  rating: number;
  price: string;
  distance: string;
  address: string;
  phone: string;
  services: string[];
  hours: string;
  specialties: string[];
  isOpen: boolean;
}

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

interface UseLocalServicesOptions {
  location: string;
}

interface LocalServicesResponse {
  servicesByCategory: Record<string, LocalService[]>;
  categories: ServiceCategory[];
  stats: {
    total: number;
    avgRating: number;
    openCount: number;
  };
}

export const useLocalServices = ({ location }: UseLocalServicesOptions) => {
  const [data, setData] = useState<LocalServicesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchServices = async () => {
    if (!location.trim()) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/services/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: location.trim(), radius: 10000 })
      });

      if (!res.ok) throw new Error(await res.text());

      setData(await res.json());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch local services';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [location]);

  return {
    data,
    loading,
    error,
    refetch: fetchServices,
  };
};