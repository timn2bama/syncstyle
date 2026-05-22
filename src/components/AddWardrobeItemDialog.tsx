import { useState } from "react";
import api from '@/lib/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  Image, 
  Crown 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { validateTextInput, validateImageFile, getSafeErrorMessage, rateLimiter } from "@/lib/security";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useUploadLimits } from "@/hooks/useUploadLimits";
import { useCreateWardrobeItem } from "@/hooks/queries/useWardrobeItems";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/utils/logger";
import DOMPurify from 'dompurify';
import { compressImage } from "@/utils/imageCompression";

interface AddWardrobeItemDialogProps {
  onItemAdded: () => void;
}

const AddWardrobeItemDialog = ({ onItemAdded }: AddWardrobeItemDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { logEvent } = useAuditLog();
  const { canUploadToCategory, getCategoryUsage, uploadLimits, refreshLimits } = useUploadLimits();
  const { user } = useAuth();
  const createItemMutation = useCreateWardrobeItem();

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    color: "",
    brand: "",
    description: "",
  });


  const categories = [
    "tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"
  ];

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    logger.info('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Check file type first
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      logger.error('Invalid file type:', file.type);
      toast({
        title: "Invalid file type",
        description: "Only JPEG, PNG, and WebP images are allowed",
        variant: "destructive",
      });
      return;
    }

    let processedFile = file;
    
    // Always compress images from phone cameras (typically > 2MB) or large images
  if (file.size > 2_000_000) {
      logger.info('File size exceeds 2MB, compressing...', file.size, 'bytes');
      toast({
        title: "Compressing image...",
        description: "Optimizing image for upload",
      });
      processedFile = await compressImage(file);
      logger.info('Compressed file size:', processedFile.size, 'bytes');
    }

    // Final validation on compressed file
    const fileValidation = validateImageFile(processedFile);
    if (!fileValidation.isValid) {
      logger.error('File validation failed:', fileValidation.error);
      toast({
        title: "Invalid file",
        description: fileValidation.error,
        variant: "destructive",
      });
      return;
    }

    logger.info('File passed validation, setting as selected file');

    setSelectedFile(processedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      logger.info('Preview URL created, length:', result?.length);
      setPreviewUrl(result);
    };
    reader.readAsDataURL(processedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Rate limiting check
    if (!rateLimiter.isAllowed('wardrobe-item-creation', 10, 60000)) {
      toast({
        title: "Too many requests",
        description: "Please wait a moment before adding another item.",
        variant: "destructive",
      });
      return;
    }

    // Check upload limits for selected category
    if (!canUploadToCategory(formData.category)) {
      const usage = getCategoryUsage(formData.category);
      toast({
        title: "Upload limit reached",
        description: `You can only upload ${usage.limit} items per category on the free plan. Upgrade to Premium for unlimited uploads.`,
        variant: "destructive",
      });
      return;
    }

    // Validate and sanitize inputs
    const nameValidation = validateTextInput(formData.name, 'name');
    const colorValidation = validateTextInput(formData.color, 'color');
    const brandValidation = validateTextInput(formData.brand, 'brand');

    if (!nameValidation.isValid) {
      toast({
        title: "Invalid name",
        description: nameValidation.error,
        variant: "destructive",
      });
      return;
    }

    let photoUrl = null;

    // Upload photo if file is selected
    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const { url } = await api.post('/storage/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        photoUrl = url;
      } catch (error) {
        logger.error('Photo upload failed:', error);
        toast({ title: "Upload Failed", description: "Could not upload photo", variant: "destructive" });
        return;
      }
    }

    createItemMutation.mutate({
      name: nameValidation.sanitized,
      category: formData.category,
      color: colorValidation.sanitized || null,
      brand: brandValidation.sanitized || null,
      description: DOMPurify.sanitize(formData.description),
      photo_url: photoUrl,
    }, {
      onSuccess: async () => {
        // Log the creation for audit purposes
        await logEvent({
          event_type: 'wardrobe_item_created',
          details: {
            item_name: nameValidation.sanitized,
            category: formData.category,
            has_photo: !!photoUrl
          }
        });

        toast({
          title: "Success!",
          description: "Item added to your wardrobe.",
        });

        // Reset form
        setFormData({ name: "", category: "", color: "", brand: "", description: "" });
        setSelectedFile(null);
        setPreviewUrl(null);
        setOpen(false);
        refreshLimits(); // Refresh limits after successful upload
        onItemAdded();
      }
    });
  };

  const loading = createItemMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="premium" size="lg" className="shadow-glow">
          Add New Item to Wardrobe
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Wardrobe Item</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label htmlFor="photo">Photo</Label>
            <div className="border-2 border-dashed border-input rounded-lg p-4 text-center">
              {previewUrl ? (
                <div className="space-y-2">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-32 object-cover rounded-md"
                    onError={() => {
                      logger.error('Preview image failed to load:', previewUrl);
                    }}
                    onLoad={() => {
                      logger.info('Preview image loaded successfully');
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      logger.info('Removing preview image');
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    Remove Photo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Image className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload a photo</p>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      logger.info('Opening file picker');
                      document.getElementById('photo')?.click();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Item Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Black Blazer"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add some details about this item..."
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => {
                  const usage = getCategoryUsage(category);
                  const isAtLimit = !canUploadToCategory(category);
                  return (
                    <SelectItem key={category} value={category} disabled={isAtLimit}>
                      <div className="flex items-center justify-between w-full">
                        <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                        {!uploadLimits.isUnlimited && (
                          <span className={`text-xs ml-2 ${isAtLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {usage.used}/{usage.limit}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {formData.category && !uploadLimits.isUnlimited && (
              <div className="text-xs text-muted-foreground">
                {(() => {
                  const usage = getCategoryUsage(formData.category);
                  return `${usage.used}/${usage.limit} items used in this category`;
                })()}
              </div>
            )}
            {!uploadLimits.isUnlimited && (
              <Alert>
                <Crown className="h-4 w-4" />
                <AlertDescription>
                  Free plan: 4 items per category. <strong>Upgrade to Premium for unlimited uploads!</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              placeholder="e.g., Black, Navy, Red"
            />
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="e.g., Zara, H&M, Nike"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name || !formData.category}
              className="flex-1 bg-gradient-primary hover:opacity-90"
            >
              {loading ? "Adding to Wardrobe..." : "💾 Add to Wardrobe"}
            </Button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddWardrobeItemDialog;
