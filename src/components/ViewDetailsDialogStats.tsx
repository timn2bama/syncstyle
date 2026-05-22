// Extracted from ViewDetailsDialog.tsx per TODO: wear count, last worn, metadata display
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

interface ViewDetailsDialogStatsProps {
  item: ClothingItem;
  sanitizedDescription: string | null;
}

const ViewDetailsDialogStats = ({
  item,
  sanitizedDescription,
}: ViewDetailsDialogStatsProps) => {
  return (
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
    </div>
  );
};

export default ViewDetailsDialogStats;
