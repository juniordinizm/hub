import { Cancel01Icon, FilterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  ADMIN_ORDER_CHECKOUT_FILTERS,
  ADMIN_ORDER_PAYMENT_METHOD_FILTERS,
  ADMIN_ORDER_STATUS_FILTERS,
  type AdminOrderCheckoutFilter,
  type AdminOrderPaymentMethodFilter,
  type AdminOrderStatusFilter,
  getAdminOrderCheckoutFilterLabel,
  getAdminOrderPaymentMethodFilterLabel,
  getAdminOrderStatusFilterLabel,
} from "@/features/admin/order-filters";
import { route } from "@/lib/routes";

interface OrdersFilterHrefOptions {
  checkout?: AdminOrderCheckoutFilter | undefined;
  paymentMethod?: AdminOrderPaymentMethodFilter | undefined;
  search: string;
  status?: AdminOrderStatusFilter | undefined;
}

export const getOrdersFilterHref = ({
  checkout,
  paymentMethod,
  search,
  status,
}: OrdersFilterHrefOptions): string => {
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
  return route(`/admin/financeiro?${params.toString()}`);
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
        href={href}
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
        href={onRemoveHref}
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

export function FinancialOrdersFilterMenu({
  checkout,
  paymentMethod,
  search,
  status,
}: {
  checkout?: AdminOrderCheckoutFilter | undefined;
  paymentMethod?: AdminOrderPaymentMethodFilter | undefined;
  search: string;
  status?: AdminOrderStatusFilter | undefined;
}): React.JSX.Element {
  const activeFilterCount =
    Number(Boolean(search)) +
    Number(Boolean(status)) +
    Number(Boolean(paymentMethod)) +
    Number(Boolean(checkout));
  const baseHref = (
    options: Partial<
      Pick<
        OrdersFilterHrefOptions,
        "checkout" | "paymentMethod" | "search" | "status"
      >
    > = {}
  ) =>
    getOrdersFilterHref({
      checkout: options.checkout,
      paymentMethod: options.paymentMethod,
      search: options.search ?? search,
      status: options.status,
    });

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Abrir filtros de pedidos"
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
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Filtrar pedidos por</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Estado do checkout
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <FilterMenuLink
                    active={!checkout}
                    href={baseHref({
                      checkout: undefined,
                      paymentMethod,
                      status,
                    })}
                  >
                    Todos
                  </FilterMenuLink>
                  {ADMIN_ORDER_CHECKOUT_FILTERS.map((option) => (
                    <FilterMenuLink
                      active={checkout === option.value}
                      href={baseHref({
                        checkout: option.value,
                        paymentMethod,
                        status: "pending",
                      })}
                      key={option.value}
                    >
                      {option.label}
                    </FilterMenuLink>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Tipo de pagamento</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <FilterMenuLink
                    active={!paymentMethod}
                    href={baseHref({ checkout, status })}
                  >
                    Todos
                  </FilterMenuLink>
                  {ADMIN_ORDER_PAYMENT_METHOD_FILTERS.map((option) => (
                    <FilterMenuLink
                      active={paymentMethod === option.value}
                      href={baseHref({
                        checkout,
                        paymentMethod: option.value,
                        status,
                      })}
                      key={option.value}
                    >
                      {option.label}
                    </FilterMenuLink>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Status do pedido</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <FilterMenuLink
                    active={!status}
                    href={baseHref({ checkout, paymentMethod })}
                  >
                    Todos
                  </FilterMenuLink>
                  {ADMIN_ORDER_STATUS_FILTERS.map((option) => (
                    <FilterMenuLink
                      active={status === option}
                      href={baseHref({
                        checkout: option === "pending" ? checkout : undefined,
                        paymentMethod,
                        status: option,
                      })}
                      key={option}
                    >
                      {getAdminOrderStatusFilterLabel(option)}
                    </FilterMenuLink>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          {activeFilterCount > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild variant="destructive">
                  <Link href={baseHref({ search: "" })}>Limpar filtros</Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {status ? (
        <ActiveFilterPill
          label={`Status: ${getAdminOrderStatusFilterLabel(status)}`}
          onRemoveHref={baseHref({ checkout, paymentMethod })}
        />
      ) : null}
      {checkout ? (
        <ActiveFilterPill
          label={`Checkout: ${getAdminOrderCheckoutFilterLabel(checkout)}`}
          onRemoveHref={baseHref({
            checkout: undefined,
            paymentMethod,
            status,
          })}
        />
      ) : null}
      {paymentMethod ? (
        <ActiveFilterPill
          label={`Pagamento: ${getAdminOrderPaymentMethodFilterLabel(paymentMethod)}`}
          onRemoveHref={baseHref({ checkout, status })}
        />
      ) : null}
      {search ? (
        <ActiveFilterPill
          label={`Busca: ${search}`}
          onRemoveHref={baseHref({
            checkout,
            paymentMethod,
            search: "",
            status,
          })}
        />
      ) : null}
    </div>
  );
}
