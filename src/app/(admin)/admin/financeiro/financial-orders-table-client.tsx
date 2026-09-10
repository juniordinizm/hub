"use client";

import { useRef, useState } from "react";
import type { AdminOrder } from "@/features/admin/server";
import {
  FinancialOrderDetailsDialog,
  FinancialOrderTableRow,
} from "./financial-order-details-dialog";

export function FinancialOrdersTableClient({
  canManageFinancialOperations,
  orders,
}: {
  canManageFinancialOperations: boolean;
  orders: AdminOrder[];
}): React.JSX.Element {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? null;

  const openDetails = (
    order: AdminOrder,
    trigger?: HTMLButtonElement
  ): void => {
    triggerRef.current = trigger ?? null;
    setSelectedOrderId(order.id);
  };

  return (
    <>
      {orders.map((order) => (
        <FinancialOrderTableRow
          key={order.id}
          onOpen={(trigger) => openDetails(order, trigger)}
          open={selectedOrderId === order.id}
          order={order}
        />
      ))}
      {selectedOrder ? (
        <FinancialOrderDetailsDialog
          canManageFinancialOperations={canManageFinancialOperations}
          hasPendingBuyerIdentityReview={Boolean(
            selectedOrder.hasPendingBuyerIdentityReview
          )}
          key={`${selectedOrder.id}:${selectedOrder.installmentPaymentCount ?? 0}:${selectedOrder.installmentPaymentsSyncedAt?.getTime() ?? 0}`}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedOrderId(null);
            }
          }}
          open
          order={selectedOrder}
          triggerRef={triggerRef}
        />
      ) : null}
    </>
  );
}
