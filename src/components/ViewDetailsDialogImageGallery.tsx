// Extracted from ViewDetailsDialog.tsx per TODO: photo display + upload logic
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Camera, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import ProgressiveImage from "@/components/ProgressiveImage";

interface ViewDetailsDialogImageGalleryProps {
  itemName: string;
  photos: string[];
  hasPhotos: boolean;
  currentPhotoIndex: number;
  previewImage: string | null;
  uploading: boolean;
  onNextPhoto: () => void;
  onPrevPhoto: () => void;
  onGoToPhoto: (index: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  cameraInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ViewDetailsDialogImageGallery = ({
  itemName,
  photos,
  hasPhotos,
  currentPhotoIndex,
  previewImage,
  uploading,
  onNextPhoto,
  onPrevPhoto,
  onGoToPhoto,
  fileInputRef,
  cameraInputRef,
  onFileChange,
}: ViewDetailsDialogImageGalleryProps) => {
  return (
    <div className="space-y-4">
      {/* Main Photo Display */}
      <div className="relative group">
        <div className="aspect-[3/4] rounded-lg overflow-hidden bg-secondary/20">
          {hasPhotos ? (
            <>
              <ProgressiveImage
                src={photos[currentPhotoIndex]}
                alt={`${itemName} - Photo ${currentPhotoIndex + 1}`}
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
                    onClick={onPrevPhoto}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                    onClick={onNextPhoto}
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
              onClick={() => onGoToPhoto(index)}
              className={cn(
                "flex-shrink-0 aspect-square w-16 h-16 rounded-md overflow-hidden border-2 transition-all",
                currentPhotoIndex === index
                  ? "border-primary shadow-md"
                  : "border-border hover:border-primary/50"
              )}
            >
              <ProgressiveImage
                src={photo}
                alt={`${itemName} thumbnail ${index + 1}`}
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
        onChange={onFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
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
  );
};

export default ViewDetailsDialogImageGallery;
