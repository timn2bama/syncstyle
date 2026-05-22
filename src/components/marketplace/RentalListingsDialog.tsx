import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { authClient } from '@/lib/auth-client';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, DollarSign, Package, Plus } from 'lucide-react';
import CreateRentalListingDialog from './CreateRentalListingDialog';
import { logger } from "@/utils/logger";

interface RentalListingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RentalItem {
  id: string;
  title: string;
  description: string | null;
  daily_rate: number;
  weekly_rate: number | null;
  deposit_amount: number;
  category: string;
  size: string;
  brand: string | null;
  photos: any;
  created_at: string;
}

const RentalListingsDialog: React.FC<RentalListingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rentalItems, setRentalItems] = useState<RentalItem[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (open) {
      fetchRentalItems();
    }
  }, [open]);

  const fetchRentalItems = async () => {
    try {
      const { data: sessionData } = await authClient.getSession();
      const headers: Record<string, string> = sessionData?.session
        ? { 'Authorization': `Bearer ${sessionData.session.token}` }
        : {};
      const response = await fetch('/api/rentals', { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setRentalItems((data as any[]) || []);
    } catch (error) {
      logger.error('Error fetching rental items:', error);
      toast({
        title: "Error",
        description: "Failed to load rental items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRentItem = async (item: RentalItem) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to rent items",
        variant: "destructive",
      });
      return;
    }

    // This would open a booking dialog in a real implementation
    toast({
      title: "Rent Item",
      description: `${item.title} - $${item.daily_rate}/day`,
    });
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Fashion Rental Platform
            </DialogTitle>
            <DialogDescription>
              Rent high-quality fashion items for special occasions or try new styles
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {rentalItems.length} items available for rent
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                List for Rent
              </Button>
            </div>

            {/* Rental Items Grid */}
            {rentalItems.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No rental items available</h3>
                  <p className="text-muted-foreground mb-4">Be the first to list an item for rent!</p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    List Item for Rent
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rentalItems.map((item) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow duration-200">
                    <div className="aspect-square bg-muted rounded-t-lg relative overflow-hidden">
                      {item.photos && item.photos.length > 0 ? (
                        <img 
                          src={item.photos[0]} 
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-16 w-16 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-blue-500">
                          For Rent
                        </Badge>
                      </div>
                    </div>
                    
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2 line-clamp-2">{item.title}</h3>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary">{item.brand}</Badge>
                        <Badge variant="outline">{item.category}</Badge>
                        {item.size && <Badge variant="outline">Size {item.size}</Badge>}
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            <span className="font-semibold">${item.daily_rate}/day</span>
                            {item.weekly_rate && (
                              <span className="text-muted-foreground ml-2">
                                ${item.weekly_rate}/week
                              </span>
                            )}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            ${item.deposit_amount} deposit
                          </span>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        onClick={() => handleRentItem(item)}
                      >
                        Rent This Item
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateRentalListingDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchRentalItems}
      />
    </>
  );
};

export default RentalListingsDialog;