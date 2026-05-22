// Extracted from ViewDetailsDialog.tsx per TODO: outfit-related action buttons and dialogs
import { Button } from "@/components/ui/button";
import AddToOutfitDialog from "./AddToOutfitDialog";
import OutfitSuggestionsDialog from "./OutfitSuggestionsDialog";

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

interface ViewDetailsDialogActionsProps {
  item: ClothingItem;
  onMarkAsWornToday: () => void;
  onItemUpdated?: () => void;
}

const ViewDetailsDialogActions = ({
  item,
  onMarkAsWornToday,
  onItemUpdated,
}: ViewDetailsDialogActionsProps) => {
  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        variant="elegant"
        onClick={onMarkAsWornToday}
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
  );
};

export default ViewDetailsDialogActions;
