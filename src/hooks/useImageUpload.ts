import { useState } from 'react';
import { compressImage } from '@/utils/imageCompression';
import { useToast } from '@/hooks/use-toast';
import { logger } from "@/utils/logger";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const { toast } = useToast();

  const uploadImage = async (file: File, _path?: string): Promise<string | null> => {
    try {
      setUploading(true);
      setProgress({ loaded: 0, total: 100, percentage: 0 });

      // Compress image before upload
      const compressedFile = await compressImage(file, 1280, 0.8, 0.75);

      setProgress({ loaded: 30, total: 100, percentage: 30 });

      const formData = new FormData();
      formData.append('file', compressedFile);

      setProgress({ loaded: 60, total: 100, percentage: 60 });

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const { url } = await response.json();

      setProgress({ loaded: 100, total: 100, percentage: 100 });

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });

      return url;
    } catch (error) {
      logger.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return {
    uploadImage,
    uploading,
    progress
  };
};
