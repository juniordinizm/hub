import { ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/table";
import type {
  AdminOrderCheckoutFilter,
  AdminOrderPaymentMethodFilter,
  AdminOrderStatusFilter,
} from "@/features/admin/order-filters";
import type { AdminOrder } from "@/features/admin/server";
import { FinancialOrdersFilterMenu } from "./financial-orders-filter-menu";
import { FinancialOrdersTableClient } from "./financial-orders-table-client";

const getOrderPageHref = ({
  checkout,
  page,
  paymentMethod,
  search,
  status,
}: {
  checkout?: AdminOrderCheckoutFilter | undefined;
  page: number;
  paymentMethod?: AdminOrderPaymentMethodFilter | undefined;
  search: string;
  status?: AdminOrderStatusFilter | undefined;
}): string => {
  const params = new URLSearchParams({ tab: "orders" });
  if (checkout) {
    params.set("checkout", checkout);
  }
  if (search) {
    params.set("q", search);
  }
  if (status) {
    params.set("status", status);
  }
  if (paymentMethod) {
    params.set("paymentMethod", paymentMethod);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/admin/financeiro?${query}` : "/admin/financeiro";
};

function OrderTableEmptyState({
  hasActiveFilter,
  totalCount,
}: {
  hasActiveFilter: boolean;
  totalCount: number;
}): React.JSX.Element {
  let title = "Nenhum pedido";
  let description = "Ainda não há pedidos registrados na plataforma.";

  if (totalCount > 0) {
    title = "Nenhum pedido nesta página";
    description = "Volte uma página para continuar consultando os pedidos.";
  } else if (hasActiveFilter) {
    title = "Nenhum pedido corresponde aos filtros";
    description =
      "Ajuste ou limpe os filtros para consultar outro conjunto de pedidos.";
  }

  return (
    <TableRow>
      <TableCell className="h-48 p-0" colSpan={6}>
        <Empty className="rounded-none border-0 border-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon aria-hidden="true" icon={ShoppingCart01Icon} />
            </EmptyMedia>
            <EmptyTitle as="h3">{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </TableCell>
    </TableRow>
  );
}

export function FinancialOrdersTable({
  canManageFinancialOperations,
  checkout,
  hasNextPage,
  orders,
  page,
  paymentMethod,
  search,
  status,
  totalCount,
}: {
  canManageFinancialOperations: boolean;
  checkout?: AdminOrderCheckoutFilter | undefined;
  hasNextPage: boolean;
  orders: AdminOrder[];
  page: number;
  paymentMethod?: AdminOrderPaymentMethodFilter | undefined;
  search: string;
  status?: AdminOrderStatusFilter | undefined;
  totalCount: number;
}): React.JSX.Element {
  const hasActiveFilter = Boolean(
    search || status || paymentMethod || checkout
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          action="/admin/financeiro"
          className="flex min-w-0 flex-1 basis-full gap-2 sm:max-w-xl sm:basis-auto"
          method="get"
        >
          <input name="page" type="hidden" value="1" />
          <input name="checkout" type="hidden" value={checkout ?? ""} />
          <input
            name="paymentMethod"
            type="hidden"
            value={paymentMethod ?? ""}
          />
          <input name="status" type="hidden" value={status ?? ""} />
          <input name="tab" type="hidden" value="orders" />
          <label className="sr-only" htmlFor="financial-order-search">
            Buscar pedidos
          </label>
          <Input
            aria-label="Buscar pedidos"
            autoComplete="off"
            className="min-w-0 flex-1"
            defaultValue={search}
            id="financial-order-search"
            name="q"
            placeholder="Buscar por pedido, cliente, e-mail ou ID Asaas…"
          />
          <Button type="submit">Buscar</Button>
        </form>
        <FinancialOrdersFilterMenu
          checkout={checkout}
          paymentMethod={paymentMethod}
          search={search}
          status={status}
        />
      </div>

      <div className="rounded-lg border">
        <Table className="min-w-[720px]">
          <TableCaption className="sr-only">
            Pedidos e pagamentos registrados
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Compradora</TableHead>
              <TableHead scope="col">Curso</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead className="text-right" scope="col">
                Valor
              </TableHead>
              <TableHead className="whitespace-nowrap" scope="col">
                Registrado em
              </TableHead>
              <TableHead className="text-right" scope="col">
                Detalhes
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length > 0 ? (
              <FinancialOrdersTableClient
                canManageFinancialOperations={canManageFinancialOperations}
                orders={orders}
              />
            ) : (
              <OrderTableEmptyState
                hasActiveFilter={hasActiveFilter}
                totalCount={totalCount}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {page > 1 || hasNextPage ? (
        <div className="mt-4">
          <Separator />
          <div className="flex justify-end gap-3 pt-4">
            <nav aria-label="Paginação de pedidos" className="flex gap-2">
              {page > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={getOrderPageHref({
                      page: page - 1,
                      checkout,
                      paymentMethod,
                      search,
                      status,
                    })}
                  >
                    Anterior
                  </Link>
                </Button>
              ) : (
                <Button disabled variant="outline">
                  Anterior
                </Button>
              )}
              {hasNextPage ? (
                <Button asChild variant="outline">
                  <Link
                    href={getOrderPageHref({
                      page: page + 1,
                      checkout,
                      paymentMethod,
                      search,
                      status,
                    })}
                  >
                    Próxima
                  </Link>
                </Button>
              ) : (
                <Button disabled variant="outline">
                  Próxima
                </Button>
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
