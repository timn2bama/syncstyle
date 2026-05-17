// TODO: This component is large and handles multiple concerns. Extract into:
// - ViewDetailsImageGallery (photo display + upload logic)
// - ViewDetailsActions (outfit-related action buttons and dialogs)
// - ViewDetailsStats (wear count, last worn, metadata display)
import { useState, useRef, useEffect, useMemo } from "react";
import { compressImage } from '../utils/imageCompression';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Eye, Camera, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import ProgressiveImage from "@/components/ProgressiveImage";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AddToOutfitDialog from "./AddToOutfitDialog";
import OutfitSuggestionsDialog from "./OutfitSuggestionsDialog";
import { logger } from "@/utils/logger";
import DOMPurify from 'dompurify';

interface ClothingItem {
  id: string;
  name: string;
  category: string;
  wearCount: number;
  lastWorn: string;
  color: string | null;
  brand: string | null;
  photo_url: string | null;
  description?: string | null;
}

interface ViewDetailsDialogProps {
  item: ClothingItem;
  children: React.ReactNode;
  onItemUpdated?: () => void;
}

const ViewDetailsDialog = ({ item, children, onItemUpdated }: ViewDetailsDialogProps) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  // Use the uploaded photo if available
  const photos = item.photo_url ? [item.photo_url] : [];
  const hasPhotos = photos.length > 0;

  const sanitizedDescription = useMemo(() => {
    return item.description ? DOMPurify.sanitize(item.description) : null;
  }, [item.description]);

  useEffect(() => {
    logger.info('ViewDetailsDialog - Item received:', {
      id: item.id,
      name: item.name,
      photo_url: item.photo_url,
      hasPhotos: hasPhotos,
      photosArray: photos
    });
  }, [item, hasPhotos, photos]);

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const goToPhoto = (index: number) => {
    setCurrentPhotoIndex(index);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    logger.info('ViewDetailsDialog - File upload started:', file.name, file.size);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setPreviewImage(previewUrl);
    setUploading(true);
    
    try {
      // Compress large images before uploading to save bandwidth and storage
      const uploadFile = file.size > 2_000_000 ? await compressImage(file) : file;

      logger.info('ViewDetailsDialog - Uploading, originalSize:', file.size, 'uploadSize:', uploadFile.size);

      const formData = new FormData();
      formData.append('file', uploadFile);

      const uploadResponse = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }));
        logger.error('ViewDetailsDialog - Upload error:', errorData);
        throw new Error(errorData.error || 'Upload failed');
      }

      const { url: publicUrl } = await uploadResponse.json();
      logger.info('ViewDetailsDialog - Upload successful, URL:', publicUrl);

      const { data: sessionData } = await authClient.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionData?.session) {
        headers['Authorization'] = `Bearer ${sessionData.session.token}`;
      }

      const updateResponse = await fetch(`/api/wardrobe/${item.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ photo_url: publicUrl }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({ error: 'Update failed' }));
        logger.error('ViewDetailsDialog - Update error:', errorData);
        throw new Error(errorData.error || 'Update failed');
      }

      logger.info('ViewDetailsDialog - Update successful');

      toast.success('Photo uploaded successfully!');
      setPreviewImage(null); // Clear preview
      onItemUpdated?.();
    } catch (error) {
      logger.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
      setPreviewImage(null); // Clear preview on error
    } finally {
      setUploading(false);
      // Clean up the preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  const markAsWornToday = async () => {
    try {
      const { data: sessionData } = await authClient.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionData?.session) {
        headers['Authorization'] = `Bearer ${sessionData.session.token}`;
      }

      const response = await fetch(`/api/wardrobe/${item.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          wear_count: item.wearCount + 1,
          last_worn: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(errorData.error || 'Update failed');
      }

      toast.success(`Marked "${item.name}" as worn today!`);
      onItemUpdated?.(); // Refresh the data
    } catch (error) {
      logger.error('Error marking item as worn:', error);
      toast.error('Failed to mark item as worn');
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] mx-4 sm:mx-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 overflow-y-auto max-h-[80vh]">
          {/* Photo Gallery */}
          <div className="space-y-4">
            {/* Main Photo Display */}
            <div className="relative group">
              <div className="aspect-[3/4] rounded-lg overflow-hidden bg-secondary/20">
                {hasPhotos ? (
                  <>
                    <ProgressiveImage
                      src={photos[currentPhotoIndex]}
                      alt={`${item.name} - Photo ${currentPhotoIndex + 1}`}
                      className="w-full h-full object-cover"
                      sizes="(max-width: 640px) 100vw, 600px"
                    />
                    
                    {/* Navigation Arrows */}
                    {photos.length > 1 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                          onClick={prevPhoto}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                          onClick={nextPhoto}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    {/* Photo Counter */}
                    {photos.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 text-sm">
                        {currentPhotoIndex + 1} / {photos.length}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <ImagePlus className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No Photos</p>
                    <p className="text-sm text-center px-4">
                      Upload a photo to see your item here
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Image */}
            {previewImage && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Uploading Preview:</p>
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-secondary/20 border-2 border-dashed border-primary/50">
                  <img
                    src={previewImage}
                    alt="Upload preview"
                    className="w-full h-full object-cover"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <p className="text-sm font-medium">Uploading...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Photo Thumbnails */}
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => goToPhoto(index)}
                    className={cn(
                      "flex-shrink-0 aspect-square w-16 h-16 rounded-md overflow-hidden border-2 transition-all",
                      currentPhotoIndex === index
                        ? "border-primary shadow-md"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <ProgressiveImage
                      src={photo}
                      alt={`${item.name} thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      sizes="64px"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Upload Photo Options */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'From Gallery'}
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Take Photo'}
              </Button>
            </div>
          </div>

          {/* Item Details */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
               <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  {item.color && <Badge variant="secondary">{item.color}</Badge>}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brand</span>
                    <span className="font-medium">{item.brand || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium capitalize">{item.category}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {sanitizedDescription && (
              <Card>
                <CardContent className="p-3 sm:p-4 space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Description</h4>
                  <div 
                    className="text-sm prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Wear Statistics */}
            <Card>
               <CardContent className="p-3 sm:p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="text-fashion-gold">📊</span>
                  Wear Statistics
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Times Worn</span>
                    <span className="font-medium">{item.wearCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Worn</span>
                    <span className="font-medium">{item.lastWorn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frequency</span>
                    <span className="font-medium">
                      {item.wearCount > 20 ? "High" : item.wearCount > 10 ? "Medium" : "Low"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Care Instructions */}
            <Card>
              <CardContent className="p-3 sm:p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="text-fashion-gold">🧺</span>
                  Care Instructions
                </h4>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>• Machine wash cold with like colors</div>
                  <div>• Tumble dry low heat</div>
                  <div>• Iron on medium heat if needed</div>
                  <div>• Do not bleach</div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="space-y-2">
              <Button 
                className="w-full" 
                variant="elegant"
                onClick={markAsWornToday}
              >
                Mark as Worn Today
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AddToOutfitDialog item={item}>
                  <Button variant="outline">
                    Add to Outfit
                  </Button>
                </AddToOutfitDialog>
                <OutfitSuggestionsDialog baseItem={item} onOutfitCreated={onItemUpdated}>
                  <Button variant="outline">
                    Smart Suggestions
                  </Button>
                </OutfitSuggestionsDialog>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewDetailsDialog;
