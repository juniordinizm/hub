"use client";

import {
  Calendar03Icon,
  Cancel01Icon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  endOfMonth,
  format,
  isSameDay,
  parse,
  startOfMonth,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAuditFilterHref } from "@/features/admin/audit-filter-url";
import {
  ADMIN_AUDIT_SOURCE_LABELS,
  ADMIN_AUDIT_TARGET_LABELS,
  type AdminAuditSource,
  type AdminAuditTargetType,
} from "@/features/admin/audit-filters";
import { route } from "@/lib/routes";

const DATE_FORMAT = "yyyy-MM-dd";

const formatDateLabel = (value: string): string => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const parseDate = (value: string): Date | undefined => {
  if (!value) {
    return;
  }
  const date = parse(value, DATE_FORMAT, new Date());
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const getInitialRange = (from: string, to: string): DateRange | undefined => {
  const start = parseDate(from);
  const finish = parseDate(to);
  if (!(start || finish)) {
    return;
  }
  return { from: start ?? finish, to: finish };
};

const getPresetRange = (preset: "7" | "30" | "90" | "month") => {
  const today = new Date();
  if (preset === "month") {
    return {
      from: format(startOfMonth(today), DATE_FORMAT),
      to: format(endOfMonth(today), DATE_FORMAT),
    };
  }
  const days = Number(preset);
  return {
    from: format(subDays(today, days - 1), DATE_FORMAT),
    to: format(today, DATE_FORMAT),
  };
};

function FilterMenuLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}): React.JSX.Element {
  return (
    <DropdownMenuItem asChild>
      <Link
        aria-current={active ? "true" : undefined}
        className="flex w-full items-center"
        href={route(href)}
      >
        {children}
        {active ? (
          <Badge className="ml-auto" variant="outline">
            Atual
          </Badge>
        ) : null}
      </Link>
    </DropdownMenuItem>
  );
}

function ActiveFilterPill({
  label,
  onRemoveHref,
}: {
  label: string;
  onRemoveHref: string;
}): React.JSX.Element {
  return (
    <Badge
      asChild
      className="min-h-9 max-w-full cursor-pointer px-2.5 py-1"
      variant="secondary"
    >
      <Link
        aria-label={`Remover filtro ${label}`}
        className="flex min-h-9 max-w-full items-center gap-1.5"
        href={route(onRemoveHref)}
        title={`Remover filtro ${label}`}
      >
        <span className="truncate">{label}</span>
        <HugeiconsIcon
          aria-hidden="true"
          icon={Cancel01Icon}
          size={14}
          strokeWidth={2}
        />
      </Link>
    </Badge>
  );
}

export function AuditFilterMenu({
  from,
  search,
  source,
  targetType,
  to,
}: {
  from: string;
  search: string;
  source: AdminAuditSource;
  targetType: AdminAuditTargetType;
  to: string;
}): React.JSX.Element {
  const [customPeriodOpen, setCustomPeriodOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() =>
    getInitialRange(from, to)
  );
  const activeFilterCount =
    Number(source !== "all") +
    Number(targetType !== "all") +
    Number(Boolean(from || to)) +
    Number(Boolean(search));
  const baseHref = (
    options: Partial<{
      from: string;
      search: string;
      source: AdminAuditSource;
      targetType: AdminAuditTargetType;
      to: string;
    }> = {}
  ): string =>
    getAuditFilterHref({
      from: options.from ?? from,
      search: options.search ?? search,
      source: options.source ?? source,
      targetType: options.targetType ?? targetType,
      to: options.to ?? to,
    });
  const openCustomPeriod = (): void => {
    setCustomRange(getInitialRange(from, to));
    setCustomPeriodOpen(true);
  };
  const customFrom = customRange?.from
    ? format(customRange.from, DATE_FORMAT)
    : "";
  const customTo = customRange?.to ? format(customRange.to, DATE_FORMAT) : "";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Abrir filtros da auditoria"
            className="gap-2"
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={FilterIcon}
              size={16}
              strokeWidth={2}
            />
            Filtros
            {activeFilterCount > 0 ? (
              <Badge variant="secondary">{activeFilterCount}</Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Adicionar filtro</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Origem</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <FilterMenuLink
                  active={source === "all"}
                  href={baseHref({ source: "all" })}
                >
                  Todas
                </FilterMenuLink>
                {Object.entries(ADMIN_AUDIT_SOURCE_LABELS).map(
                  ([value, label]) => (
                    <FilterMenuLink
                      active={source === value}
                      href={baseHref({
                        source: value as Exclude<AdminAuditSource, "all">,
                      })}
                      key={value}
                    >
                      {label}
                    </FilterMenuLink>
                  )
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Registro</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <FilterMenuLink
                  active={targetType === "all"}
                  href={baseHref({ targetType: "all" })}
                >
                  Todos
                </FilterMenuLink>
                {Object.entries(ADMIN_AUDIT_TARGET_LABELS).map(
                  ([value, label]) => (
                    <FilterMenuLink
                      active={targetType === value}
                      href={baseHref({
                        targetType: value as Exclude<
                          AdminAuditTargetType,
                          "all"
                        >,
                      })}
                      key={value}
                    >
                      {label}
                    </FilterMenuLink>
                  )
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Período</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <FilterMenuLink
                  active={!(from || to)}
                  href={baseHref({ from: "", to: "" })}
                >
                  Todo o período
                </FilterMenuLink>
                {[
                  ["7", "Últimos 7 dias"],
                  ["30", "Últimos 30 dias"],
                  ["90", "Últimos 90 dias"],
                  ["month", "Este mês"],
                ].map(([preset, label]) => {
                  const presetRange = getPresetRange(
                    preset as "7" | "30" | "90" | "month"
                  );
                  return (
                    <FilterMenuLink
                      active={
                        from === presetRange.from && to === presetRange.to
                      }
                      href={baseHref(presetRange)}
                      key={preset}
                    >
                      {label}
                    </FilterMenuLink>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={openCustomPeriod}>
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={Calendar03Icon}
                    size={16}
                    strokeWidth={2}
                  />
                  Período personalizado…
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          {activeFilterCount > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild variant="destructive">
                <Link href={route("/admin/auditoria")}>Limpar filtros</Link>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setCustomPeriodOpen} open={customPeriodOpen}>
        <DialogContent className="w-auto max-w-md">
          <DialogHeader>
            <DialogTitle>Período personalizado</DialogTitle>
            <DialogDescription>
              Escolha a data inicial e final dos eventos que deseja consultar.
            </DialogDescription>
          </DialogHeader>
          <form
            action={route("/admin/auditoria")}
            className="grid gap-4"
            method="get"
          >
            <input name="page" type="hidden" value="1" />
            <input name="q" type="hidden" value={search} />
            <input name="source" type="hidden" value={source} />
            <input name="target" type="hidden" value={targetType} />
            <input name="from" type="hidden" value={customFrom} />
            <input name="to" type="hidden" value={customTo} />
            <Calendar
              autoFocus
              locale={ptBR}
              mode="range"
              onSelect={(nextRange, selectedDay) => {
                const sameDaySelection =
                  customRange?.from &&
                  !customRange.to &&
                  selectedDay &&
                  isSameDay(customRange.from, selectedDay);
                setCustomRange(
                  sameDaySelection
                    ? { from: customRange.from, to: selectedDay }
                    : nextRange
                );
              }}
              selected={customRange}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button disabled={!customRange?.from} type="submit">
                Aplicar período
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {source === "all" ? null : (
        <ActiveFilterPill
          label={`Origem: ${ADMIN_AUDIT_SOURCE_LABELS[source]}`}
          onRemoveHref={baseHref({ source: "all" })}
        />
      )}
      {targetType === "all" ? null : (
        <ActiveFilterPill
          label={`Registro: ${ADMIN_AUDIT_TARGET_LABELS[targetType]}`}
          onRemoveHref={baseHref({ targetType: "all" })}
        />
      )}
      {from || to ? (
        <ActiveFilterPill
          label={`Período: ${from ? formatDateLabel(from) : "início"} – ${to ? formatDateLabel(to) : "agora"}`}
          onRemoveHref={baseHref({ from: "", to: "" })}
        />
      ) : null}
      {search ? (
        <ActiveFilterPill
          label={`Busca: ${search}`}
          onRemoveHref={baseHref({ search: "" })}
        />
      ) : null}
    </div>
  );
}
