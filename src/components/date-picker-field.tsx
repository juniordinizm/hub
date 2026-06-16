"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATE_FORMAT = "yyyy-MM-dd";

const parseDateValue = (value: string): Date | undefined => {
  const parsed = parse(value, DATE_FORMAT, new Date());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export function DatePickerField({
  defaultValue,
  name,
}: {
  defaultValue: string;
  name: string;
}): React.JSX.Element {
  const [value, setValue] = useState(defaultValue);
  const selected = useMemo(() => parseDateValue(value), [value]);

  return (
    <Popover>
      <input name={name} type="hidden" value={value} />
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground"
          )}
          type="button"
          variant="outline"
        >
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
          {selected ? format(selected, "dd/MM/yyyy") : "Selecionar data"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          initialFocus
          locale={ptBR}
          mode="single"
          onSelect={(date) => {
            if (date) {
              setValue(format(date, DATE_FORMAT));
            }
          }}
          selected={selected}
        />
      </PopoverContent>
    </Popover>
  );
}
