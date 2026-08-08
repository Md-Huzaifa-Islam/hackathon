import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MovieListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="h-[320px] overflow-hidden border-white/10 bg-[color:rgba(13,12,18,0.82)]">
          <CardHeader className="p-0">
            <Skeleton className="h-[180px] w-full rounded-none" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-3/4 rounded-full" />
            <Skeleton className="h-4 w-1/2 rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-5/6 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
