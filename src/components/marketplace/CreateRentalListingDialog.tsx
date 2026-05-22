import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
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

interface CreateRentalListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  photo_url: string | null;
}

const CreateRentalListingDialog: React.FC<CreateRentalListingDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [formData, setFormData] = useState({
    wardrobe_item_id: '',
    title: '',
    description: '',
    daily_rate: '',
    weekly_rate: '',
    deposit_amount: '',
    size: '',
    rental_terms: '',
    care_instructions: '',
  });

  useEffect(() => {
    if (open && user) {
      fetchWardrobeItems();
    }
  }, [open, user]);

  const fetchWardrobeItems = async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/wardrobe', { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setWardrobeItems((data as any[]) || []);
    } catch (error) {
      logger.error('Error fetching wardrobe items:', error);
    }
  };

  const handleWardrobeItemSelect = (itemId: string) => {
    const item = wardrobeItems.find(i => i.id === itemId);
    if (item) {
      setFormData(prev => ({
        ...prev,
        wardrobe_item_id: itemId,
        title: `${item.brand || ''} ${item.name}`,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const selectedItem = wardrobeItems.find(i => i.id === formData.wardrobe_item_id);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/rentals', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          wardrobe_item_id: formData.wardrobe_item_id || null,
          title: formData.title,
          description: formData.description,
          daily_rate: parseFloat(formData.daily_rate),
          weekly_rate: formData.weekly_rate ? parseFloat(formData.weekly_rate) : null,
          deposit_amount: parseFloat(formData.deposit_amount),
          size: formData.size,
          rental_terms: formData.rental_terms,
          care_instructions: formData.care_instructions,
          category: selectedItem?.category || 'other',
          brand: selectedItem?.brand || '',
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      toast({
        title: "Success",
        description: "Your item has been listed for rent!",
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      logger.error('Error creating rental listing:', error);
      toast({
        title: "Error",
        description: "Failed to create rental listing",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      wardrobe_item_id: '',
      title: '',
      description: '',
      daily_rate: '',
      weekly_rate: '',
      deposit_amount: '',
      size: '',
      rental_terms: '',
      care_instructions: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List Item for Rent</DialogTitle>
          <DialogDescription>
            Share your fashion items with others and earn rental income.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="wardrobe_item">Select from Your Wardrobe</Label>
            <Select 
              value={formData.wardrobe_item_id} 
              onValueChange={handleWardrobeItemSelect}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an item from your wardrobe" />
              </SelectTrigger>
              <SelectContent>
                {wardrobeItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.brand || 'Unbranded'} {item.name} ({item.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title*</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Designer evening gown for special occasions"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the item, its fit, best occasions to wear it..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_rate">Daily Rate ($)*</Label>
              <Input
                id="daily_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.daily_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, daily_rate: e.target.value }))}
                placeholder="50.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekly_rate">Weekly Rate ($)</Label>
              <Input
                id="weekly_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.weekly_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, weekly_rate: e.target.value }))}
                placeholder="200.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deposit_amount">Security Deposit ($)*</Label>
              <Input
                id="deposit_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.deposit_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, deposit_amount: e.target.value }))}
                placeholder="100.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Input
                id="size"
                value={formData.size}
                onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                placeholder="M, 8, 32x30, etc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rental_terms">Rental Terms</Label>
            <Textarea
              id="rental_terms"
              value={formData.rental_terms}
              onChange={(e) => setFormData(prev => ({ ...prev, rental_terms: e.target.value }))}
              placeholder="Minimum rental period, return conditions, damage policy..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="care_instructions">Care Instructions</Label>
            <Textarea
              id="care_instructions"
              value={formData.care_instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, care_instructions: e.target.value }))}
              placeholder="Dry clean only, hand wash, storage requirements..."
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'List for Rent'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRentalListingDialog;
