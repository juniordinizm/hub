"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { format, isSameDay, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATE_FORMAT = "yyyy-MM-dd";

const normalizeDateValue = (value: string | Date): string => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${value.getUTCFullYear()}-${month}-${day}`;
  }
  return value;
};

const parseDateValue = (value: string): Date | undefined => {
  const parsed = parse(value, DATE_FORMAT, new Date());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const getInitialRange = ({
  finishValue,
  startValue,
}: {
  finishValue: string | Date;
  startValue: string | Date;
}): DateRange | undefined => {
  const from = parseDateValue(normalizeDateValue(startValue));
  const to = parseDateValue(normalizeDateValue(finishValue));
  if (!(from || to)) {
    return;
  }
  return { from: from ?? to, to };
};

const getRangeLabel = ({
  placeholder,
  range,
}: {
  placeholder: string;
  range: DateRange | undefined;
}): string => {
  if (!range?.from) {
    return placeholder;
  }
  const fromLabel = format(range.from, "dd/MM/yyyy");
  if (!range.to) {
    return `${fromLabel} – selecionar fim`;
  }
  return `${fromLabel} – ${format(range.to, "dd/MM/yyyy")}`;
};

export const isDateOutsideRange = (
  date: Date,
  {
    maxDate,
    minDate,
  }: { maxDate?: string | undefined; minDate?: string | undefined }
): boolean => {
  const value = format(date, DATE_FORMAT);
  return Boolean((minDate && value < minDate) || (maxDate && value > maxDate));
};

export function DateRangePickerField({
  defaultFinishValue = "",
  defaultStartValue = "",
  endName,
  id,
  maxDate,
  minDate,
  placeholder = "Selecionar período",
  startName,
}: {
  defaultFinishValue?: string | Date;
  defaultStartValue?: string | Date;
  endName: string;
  id?: string;
  maxDate?: string;
  minDate?: string;
  placeholder?: string;
  startName: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() =>
    getInitialRange({
      finishValue: defaultFinishValue,
      startValue: defaultStartValue,
    })
  );
  const fromValue = range?.from ? format(range.from, DATE_FORMAT) : "";
  const toValue = range?.to ? format(range.to, DATE_FORMAT) : "";
  const isDateDisabled = (date: Date): boolean =>
    isDateOutsideRange(date, { maxDate, minDate });
  const label = getRangeLabel({ placeholder, range });

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <input name={startName} type="hidden" value={fromValue} />
      <input name={endName} type="hidden" value={toValue} />
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "w-full justify-start text-left font-normal active:scale-100",
            !range?.from && "text-muted-foreground"
          )}
          id={id}
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Calendar03Icon}
            strokeWidth={2}
          />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          autoFocus
          disabled={isDateDisabled}
          locale={ptBR}
          min={1}
          mode="range"
          onSelect={(nextRange, selectedDay) => {
            const sameDaySelection =
              range?.from && !range.to && isSameDay(range.from, selectedDay);
            const resolvedRange = sameDaySelection
              ? { from: range.from, to: selectedDay }
              : nextRange;
            setRange(resolvedRange);
            if (resolvedRange?.from && resolvedRange.to) {
              setOpen(false);
            }
          }}
          selected={range}
        />
      </PopoverContent>
    </Popover>
  );
}
