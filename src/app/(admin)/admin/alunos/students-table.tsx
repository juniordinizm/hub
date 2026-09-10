"use client";

import {
  Cancel01Icon,
  FilterIcon,
  Search01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { AdminSearchPill } from "@/components/admin/admin-search-pill";
import { StudentActionsMenu } from "@/components/admin/student-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import {
  getEnrollmentStatusPresentation,
  getStudentAccessStatusPresentation,
} from "@/features/admin/status-presentation";
import type { AdminCourseStudentAction } from "@/features/admin/student-navigation";
import { formatDateTime } from "@/lib/formatters";
import {
  createGlobalStudentsTableContext,
  type StudentsTableContext,
} from "./students-table-context";

export interface StudentTableRow {
  email: string;
  lastAccessAt: string | null;
  name: string;
  platformBlockedAt: string | null;
  platformBlockedReason: string | null;
  status: string;
  userId: string;
}

const formatNullableDateTime = (value: string | null): string =>
  value ? formatDateTime(value) : "Sem registro";

const buildStudentsTableHref = (
  context: StudentsTableContext,
  page: number,
  search: string,
  filterValue: string | undefined
): string => {
  const params = new URLSearchParams(context.hiddenSearchParams ?? {});
  if (search) {
    params.set(context.searchParam, search);
  }
  if (filterValue) {
    params.set(context.filterParam, filterValue);
  }
  if (page > 1) {
    params.set(context.pageParam, String(page));
  }
  const query = params.toString();
  return query ? `${context.searchAction}?${query}` : context.searchAction;
};

function StudentStatusBadge({
  status,
  statusMode,
}: {
  status: string;
  statusMode: StudentsTableContext["statusMode"];
}): React.JSX.Element {
  const presentation =
    statusMode === "enrollment"
      ? getEnrollmentStatusPresentation(status)
      : getStudentAccessStatusPresentation(status);
  const label = statusMode === "enrollment" ? "Status" : "Estado do acesso";

  return (
    <Badge
      aria-label={`${label}: ${presentation.label}`}
      variant={presentation.variant}
    >
      {presentation.label}
    </Badge>
  );
}

function StudentFilterLink({
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
      <Link aria-current={active ? "page" : undefined} href={href}>
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

function StudentFilterPill({
  context,
  label,
  search,
}: {
  context: StudentsTableContext;
  label: string;
  search: string;
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
        href={buildStudentsTableHref(context, 1, search, undefined)}
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

function StudentsTableFilterMenu({
  context,
  search,
}: {
  context: StudentsTableContext;
  search: string;
}): React.JSX.Element {
  const activeOption = context.filterOptions.find(
    (option) => option.value === context.filterValue
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Abrir filtros: ${context.filterLabel}`}
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
            {activeOption ? <Badge variant="secondary">1</Badge> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>
            Filtrar por {context.filterLabel.toLocaleLowerCase("pt-BR")}
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <StudentFilterLink
              active={!activeOption}
              href={buildStudentsTableHref(context, 1, search, undefined)}
            >
              Todos
            </StudentFilterLink>
            {context.filterOptions.map((option) => (
              <StudentFilterLink
                active={option.value === context.filterValue}
                href={buildStudentsTableHref(context, 1, search, option.value)}
                key={option.value}
              >
                {option.label}
              </StudentFilterLink>
            ))}
          </DropdownMenuGroup>
          {activeOption ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild variant="destructive">
                <Link
                  href={buildStudentsTableHref(context, 1, search, undefined)}
                >
                  Limpar filtro
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {activeOption ? (
        <StudentFilterPill
          context={context}
          label={`${context.filterLabel}: ${activeOption.label}`}
          search={search}
        />
      ) : null}
    </div>
  );
}

export function StudentsTable({
  context = createGlobalStudentsTableContext(),
  initialAction = "details",
  initialStudentId,
  students,
  hasNextPage = false,
  onInitialOverlayClose,
  page = 1,
  search = "",
  totalCount = students.length,
}: {
  context?: StudentsTableContext;
  hasNextPage?: boolean;
  initialAction?: AdminCourseStudentAction | undefined;
  initialStudentId?: string | undefined;
  onInitialOverlayClose?: (() => void) | undefined;
  students: StudentTableRow[];
  page?: number;
  search?: string;
  totalCount?: number;
}): React.JSX.Element {
  const isPaginated = page > 1 || hasNextPage;
  let emptyTitle = context.emptyTitle;
  let emptyDescription = context.emptyDescription;
  if (totalCount > 0) {
    emptyTitle = "Nenhum Aluno nesta página";
    emptyDescription = "Volte uma página para continuar consultando os Alunos.";
  } else if (search) {
    emptyTitle = "Nenhum Aluno encontrado";
    emptyDescription = `A busca por “${search}” não retornou Alunos.`;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          action={context.searchAction}
          className="flex min-w-0 flex-1 basis-full gap-2 sm:max-w-xl sm:basis-auto"
          method="get"
        >
          {Object.entries(context.hiddenSearchParams ?? {}).map(
            ([name, value]) => (
              <input key={name} name={name} type="hidden" value={value} />
            )
          )}
          <input name={context.pageParam} type="hidden" value="1" />
          {context.filterValue ? (
            <input
              name={context.filterParam}
              type="hidden"
              value={context.filterValue}
            />
          ) : null}
          <Input
            aria-label="Buscar Alunos"
            autoComplete="off"
            className="min-w-0 flex-1"
            defaultValue={search}
            name={context.searchParam}
            placeholder={context.searchPlaceholder}
          />
          <Button type="submit">Buscar</Button>
        </form>
        <StudentsTableFilterMenu context={context} search={search} />
        {search ? (
          <AdminSearchPill
            href={buildStudentsTableHref(context, 1, "", context.filterValue)}
            value={search}
          />
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table className="min-w-[820px]">
          <TableCaption className="sr-only">{context.caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Nome</TableHead>
              <TableHead className="w-[260px]">E-mail</TableHead>
              <TableHead>
                {context.statusMode === "access" ? "Acesso" : "Status"}
              </TableHead>
              <TableHead className="whitespace-nowrap">Último acesso</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length > 0 ? (
              students.map((student) => (
                <TableRow key={student.userId}>
                  <TableRowHeader className="w-[220px] max-w-[220px]">
                    <span className="block truncate" title={student.name}>
                      {student.name}
                    </span>
                  </TableRowHeader>
                  <TableCell className="w-[260px] max-w-[260px]">
                    <span className="block truncate" title={student.email}>
                      {student.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StudentStatusBadge
                      status={student.status}
                      statusMode={context.statusMode}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatNullableDateTime(student.lastAccessAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <StudentActionsMenu
                      {...(context.courseId
                        ? { courseId: context.courseId }
                        : {})}
                      {...(initialStudentId === student.userId
                        ? {
                            initialOverlay: initialAction,
                            onInitialOverlayClose,
                          }
                        : {})}
                      student={student}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-48 p-0" colSpan={5}>
                  <Empty className="rounded-none border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={search ? Search01Icon : UserGroupIcon}
                        />
                      </EmptyMedia>
                      <EmptyTitle as="h3">{emptyTitle}</EmptyTitle>
                      <EmptyDescription>{emptyDescription}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isPaginated ? (
        <div className="mt-4">
          <Separator />
          <div className="flex justify-end gap-3 pt-4">
            <nav aria-label="Paginação de Alunos" className="flex gap-2">
              {page > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={buildStudentsTableHref(
                      context,
                      page - 1,
                      search,
                      context.filterValue
                    )}
                  >
                    Anterior
                  </Link>
                </Button>
              ) : null}
              {hasNextPage ? (
                <Button asChild variant="outline">
                  <Link
                    href={buildStudentsTableHref(
                      context,
                      page + 1,
                      search,
                      context.filterValue
                    )}
                  >
                    Próxima
                  </Link>
                </Button>
              ) : null}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
