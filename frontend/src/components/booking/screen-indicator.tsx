export function ScreenIndicator() {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-xs uppercase tracking-[0.4em] text-muted-foreground">
      <div className="h-1 w-full rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
      <span>Screen</span>
    </div>
  );
}