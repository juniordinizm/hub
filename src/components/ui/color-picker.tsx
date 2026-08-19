"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
interface ColorPickerProps {
  className?: string;
  id?: string;
  label?: string | null;
  onChange: (value: string) => void;
  value: string;
}

const isHexColor = (value: string): boolean => HEX_COLOR_PATTERN.test(value);

export function ColorPicker({
  className,
  id,
  label = "Cor",
  onChange,
  value,
}: ColorPickerProps): React.JSX.Element {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = (nextValue: string): void => {
    setDraft(nextValue);
    if (isHexColor(nextValue)) {
      onChange(nextValue.toLowerCase());
    }
  };

  const safeValue = isHexColor(value) ? value : "#17292b";
  const inputId = id ?? "color-picker-value";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2",
        className
      )}
      data-color-picker="true"
    >
      {label ? (
        <span className="text-muted-foreground text-xs">{label}</span>
      ) : null}
      <div className="flex min-w-0 items-center gap-1.5">
        <label className="sr-only" htmlFor={`${inputId}-native`}>
          {label ?? "Cor"}
        </label>
        <input
          aria-label={`${label ?? "Cor"} no seletor nativo`}
          className="size-7 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
          id={`${inputId}-native`}
          onChange={(event) => commit(event.target.value)}
          type="color"
          value={safeValue}
        />
        <Input
          aria-label={`${label ?? "Cor"} em hexadecimal`}
          className="h-7 w-24 px-2 font-mono text-xs uppercase"
          id={inputId}
          maxLength={7}
          onBlur={() => {
            if (isHexColor(draft)) {
              onChange(draft.toLowerCase());
            } else {
              setDraft(value);
            }
          }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            }
          }}
          spellCheck={false}
          value={draft}
        />
      </div>
    </div>
  );
}
