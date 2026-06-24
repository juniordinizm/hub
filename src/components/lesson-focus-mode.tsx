"use client";

import { Maximize01Icon, Minimize01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { usePanelFocusMode } from "@/components/panel-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LessonFocusLayout({
  main,
  sidebar,
}: {
  main: ReactNode;
  sidebar: ReactNode;
}): React.JSX.Element {
  const { isFocusMode } = usePanelFocusMode();

  return (
    <div
      className={cn(
        "grid h-[calc(100svh-4rem)] overflow-hidden bg-background text-foreground transition-[grid-template-columns] duration-200 ease-linear",
        isFocusMode
          ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_0px]"
          : "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]"
      )}
    >
      <section className="custom-scrollbar min-w-0 overflow-y-auto">
        {main}
      </section>
      <div
        aria-hidden={isFocusMode}
        className={cn(
          "hidden h-full min-w-0 overflow-hidden transition-opacity duration-200 ease-linear lg:block",
          isFocusMode && "pointer-events-none opacity-0"
        )}
      >
        {sidebar}
      </div>
    </div>
  );
}

export function LessonFocusHidden({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element | null {
  const { isFocusMode } = usePanelFocusMode();

  if (isFocusMode) {
    return null;
  }

  return <>{children}</>;
}

export function LessonFocusToggle(): React.JSX.Element {
  const { isFocusMode, setFocusMode } = usePanelFocusMode();

  return (
    <Button
      onClick={() => setFocusMode(!isFocusMode)}
      size="sm"
      type="button"
      variant="outline"
    >
      <HugeiconsIcon
        icon={isFocusMode ? Minimize01Icon : Maximize01Icon}
        size={16}
        strokeWidth={2}
      />
      <span className="hidden sm:inline">
        {isFocusMode ? "Sair do foco" : "Modo foco"}
      </span>
    </Button>
  );
}
