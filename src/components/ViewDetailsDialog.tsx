// Shell component — composes subcomponents extracted per TODO:
// - ViewDetailsDialogImageGallery (photo display + upload logic)
// - ViewDetailsDialogActions     (outfit-related action buttons and dialogs)
// - ViewDetailsDialogStats       (wear count, last worn, metadata display)
import { useState, useRef, useEffect, useMemo } from "react";
import { compressImage } from '../utils/imageCompression';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/utils/logger";
import DOMPurify from 'dompurify';
import ViewDetailsDialogImageGallery from "./ViewDetailsDialogImageGallery";
import ViewDetailsDialogActions from "./ViewDetailsDialogActions";
import ViewDetailsDialogStats from "./ViewDetailsDialogStats";

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
          <ViewDetailsDialogImageGallery
            itemName={item.name}
            photos={photos}
            hasPhotos={hasPhotos}
            currentPhotoIndex={currentPhotoIndex}
            previewImage={previewImage}
            uploading={uploading}
            onNextPhoto={nextPhoto}
            onPrevPhoto={prevPhoto}
            onGoToPhoto={goToPhoto}
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            onFileChange={handleFileUpload}
          />

          {/* Item Details */}
          <div className="space-y-6">
            <ViewDetailsDialogStats
              item={item}
              sanitizedDescription={sanitizedDescription}
            />
            <ViewDetailsDialogActions
              item={item}
              onMarkAsWornToday={markAsWornToday}
              onItemUpdated={onItemUpdated}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewDetailsDialog;
