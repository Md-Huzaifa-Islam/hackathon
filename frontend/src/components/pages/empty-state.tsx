import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export function EmptyState({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return (
    <Card className="border-dashed border-border/70 bg-background/40">
      <CardContent className="flex flex-col items-start gap-4 p-8">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        {actionHref ? (
          <Button asChild>
            <Link href={actionHref}>{actionLabel ?? "Explore"}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
