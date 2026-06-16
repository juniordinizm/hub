"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
          className="w-full justify-start"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
          {selected ? format(selected, "dd/MM/yyyy") : "Selecionar data"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <DayPicker
          captionLayout="dropdown"
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
