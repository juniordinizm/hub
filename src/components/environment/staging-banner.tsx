export function StagingBanner() {
  return (
    <aside className="pointer-events-auto fixed right-4 bottom-4 z-50 flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/15 px-3 py-1.5 text-warning text-xs shadow-lg backdrop-blur-md">
      <span className="size-2 shrink-0 rounded-full bg-warning" />
      <span className="font-medium">Ambiente de homologação</span>
      <span className="hidden text-[11px] text-warning/80 sm:inline">
        · Testes
      </span>
    </aside>
  );
}
