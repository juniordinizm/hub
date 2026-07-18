"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Delete02Icon,
  Edit01Icon,
  HelpSquareIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useState, useTransition } from "react";
import { SortableTableRow } from "@/components/sortable-table-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reorderFaqsAction } from "@/features/admin/actions";
import { type FaqData, FaqDeleteDialog, FaqEditDialog } from "./faq-dialogs";

interface FaqTableProps {
  faqs: FaqData[];
}

export function FaqTable({
  faqs: initialFaqs,
}: FaqTableProps): React.JSX.Element {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setFaqs(initialFaqs);
  }, [initialFaqs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = faqs.findIndex((f) => f.id === active.id);
    const newIndex = faqs.findIndex((f) => f.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newFaqs = arrayMove(faqs, oldIndex, newIndex);
      setFaqs(newFaqs);
      startTransition(() => {
        reorderFaqsAction(newFaqs.map((f) => f.id));
      });
    }
  }

  const columns: ColumnDef<FaqData>[] = [
    {
      accessorKey: "question",
      header: "Pergunta",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{row.original.question}</span>
          <span className="text-muted-foreground text-xs">
            {row.original.answer.slice(0, 100)}
            {row.original.answer.length > 100 ? "..." : ""}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "isPublished",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isPublished ? "default" : "outline"}>
          {row.original.isPublished ? "Publicado" : "Oculto"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <FaqActionsDropdown faq={row.original} />,
    },
  ];

  const table = useReactTable({
    data: faqs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (faqs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={HelpSquareIcon} />
          </EmptyMedia>
          <EmptyTitle>Nenhuma FAQ cadastrada</EmptyTitle>
          <EmptyDescription>
            Você ainda não possui nenhuma pergunta frequente na plataforma.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      id="faq-dnd"
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <TableHead className="w-[40px]" />
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <SortableContext
            items={faqs.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <SortableTableRow id={row.original.id} key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </SortableTableRow>
              ))}
            </TableBody>
          </SortableContext>
        </Table>
      </div>
    </DndContext>
  );
}

function FaqActionsDropdown({ faq }: { faq: FaqData }): React.JSX.Element {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
            <HugeiconsIcon
              icon={MoreHorizontalIcon}
              size={16}
              strokeWidth={2}
            />
            <span className="sr-only">Opções</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsEditDialogOpen(true);
            }}
          >
            <HugeiconsIcon className="mr-2 h-4 w-4" icon={Edit01Icon} />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setIsDeleteDialogOpen(true);
            }}
          >
            <HugeiconsIcon className="mr-2 h-4 w-4" icon={Delete02Icon} />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FaqEditDialog
        faq={faq}
        onOpenChange={setIsEditDialogOpen}
        open={isEditDialogOpen}
      />
      <FaqDeleteDialog
        faq={faq}
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
      />
    </div>
  );
}
