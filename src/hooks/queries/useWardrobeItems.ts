import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { WardrobeItem } from '@/types';
import api from '@/lib/api';

export const useWardrobeItems = (userId?: string) => {
  return useQuery<WardrobeItem[]>({
    queryKey: ['wardrobe-items', userId],
    queryFn: () => api.get('/wardrobe'),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useWardrobeItemsByCategory = (userId?: string) => {
  return useQuery({
    queryKey: ['wardrobe-items-by-category', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const data: WardrobeItem[] = await api.get('/wardrobe');
      
      // Count items per category
      const counts = data?.reduce((acc: { [key: string]: number }, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {}) || {};
      
      return Object.entries(counts).map(([category, count]) => ({
        category,
        count: count as number
      }));
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/** Invalidate all wardrobe-related queries after a mutation. */
const invalidateWardrobeQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
  queryClient.invalidateQueries({ queryKey: ['wardrobe-items-by-category'] });
  queryClient.invalidateQueries({ queryKey: ['wardrobe-stats'] });
};

export const useCreateWardrobeItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (item: Omit<WardrobeItem, 'id' | 'created_at' | 'updated_at'>) =>
      api.post('/wardrobe', item),
    onSuccess: () => {
      invalidateWardrobeQueries(queryClient);
      toast({
        title: "Success",
        description: "Wardrobe item added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add item", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateWardrobeItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, ...item }: Partial<WardrobeItem> & { id: string }) =>
      api.patch(`/wardrobe/${id}`, item),
    onSuccess: () => {
      invalidateWardrobeQueries(queryClient);
      toast({
        title: "Success",
        description: "Wardrobe item updated successfully.",
      });
    },
  });
};

export const useDeleteWardrobeItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/wardrobe/${id}`),
    onSuccess: () => {
      invalidateWardrobeQueries(queryClient);
      toast({
        title: "Success",
        description: "Wardrobe item deleted successfully.",
      });
    },
  });
};
