import { Badge } from "@/components/ui/badge";

export function SeatLegend() {
  const items = [
    ["AVAILABLE", "Available"],
    ["SELECTED", "Selected"],
    ["HELD", "Held"],
    ["SOLD", "Sold"],
  ] as const;

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {items.map(([key, label]) => (
        <Badge key={key} variant="secondary" className="rounded-full px-3 py-1">
          {label}
        </Badge>
      ))}
    </div>
  );
}