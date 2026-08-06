export function StagingBanner() {
  return (
    <aside className="pointer-events-auto fixed right-4 bottom-4 z-50 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/90 px-3 py-1.5 text-amber-200 text-xs shadow-lg backdrop-blur-md">
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
      <span className="font-medium">Ambiente de homologação</span>
      <span className="hidden text-[11px] text-amber-300/80 sm:inline">
        · Testes
      </span>
    </aside>
  );
}
