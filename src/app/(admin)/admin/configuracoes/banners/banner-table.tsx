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
  Image01Icon,
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
import { reorderBannersAction } from "@/features/admin/actions";
import type { AdminBanner } from "@/features/admin/server";
import { BannerDeleteDialog, BannerEditDialog } from "./banner-dialogs";

interface BannerTableProps {
  banners: AdminBanner[];
}

export function BannerTable({
  banners: initialBanners,
}: BannerTableProps): React.JSX.Element {
  const [banners, setBanners] = useState(initialBanners);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setBanners(initialBanners);
  }, [initialBanners]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = banners.findIndex((b) => b.id === active.id);
    const newIndex = banners.findIndex((b) => b.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newBanners = arrayMove(banners, oldIndex, newIndex);
      setBanners(newBanners);
      startTransition(() => {
        reorderBannersAction(newBanners.map((b) => b.id));
      });
    }
  }

  const columns: ColumnDef<AdminBanner>[] = [
    {
      accessorKey: "image",
      header: "Imagem",
      cell: ({ row }) => (
        <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {/* biome-ignore lint/correctness/useImageSize: This is a dynamic banner image */}
          {/* biome-ignore lint/performance/noImgElement: Native img is required here for external sizing */}
          <img
            alt="Banner"
            className="h-full w-full object-cover"
            src={`/api/banners/${row.original.id}/image`}
          />
        </div>
      ),
    },

    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "outline"}>
          {row.original.isActive ? "Ativo" : "Oculto"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <BannerActionsDropdown banner={row.original} />,
    },
  ];

  const table = useReactTable({
    data: banners,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (banners.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Image01Icon} />
          </EmptyMedia>
          <EmptyTitle>Nenhum banner cadastrado</EmptyTitle>
          <EmptyDescription>
            Adicione imagens para aparecerem no carrossel do dashboard do aluno.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      id="banner-dnd"
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
            items={banners.map((b) => b.id)}
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

function BannerActionsDropdown({
  banner,
}: {
  banner: AdminBanner;
}): React.JSX.Element {
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

      <BannerEditDialog
        banner={banner}
        onOpenChange={setIsEditDialogOpen}
        open={isEditDialogOpen}
      />
      <BannerDeleteDialog
        banner={banner}
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
      />
    </div>
  );
}
