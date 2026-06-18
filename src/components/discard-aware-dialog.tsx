"use client";

import type React from "react";
import { useState } from "react";
import { ConfirmDiscardDialog } from "./confirm-discard-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function DiscardAwareDialog({
  trigger,
  title,
  description,
  children,
  className,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: {
  trigger?: React.ReactNode | undefined;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}): React.JSX.Element {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isOpen = externalOpen === undefined ? internalOpen : externalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setShowDiscardConfirm(true);
      return;
    }

    if (externalOnOpenChange) {
      externalOnOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }

    if (!newOpen) {
      setIsDirty(false);
    }
  };

  const handleConfirmDiscard = () => {
    setIsDirty(false);
    if (externalOnOpenChange) {
      externalOnOpenChange(false);
    } else {
      setInternalOpen(false);
    }
  };

  return (
    <>
      <Dialog onOpenChange={handleOpenChange} open={isOpen}>
        {trigger}
        <DialogContent className={className}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div onChange={() => setIsDirty(true)}>{children}</div>
        </DialogContent>
      </Dialog>
      <ConfirmDiscardDialog
        onConfirm={handleConfirmDiscard}
        onOpenChange={setShowDiscardConfirm}
        open={showDiscardConfirm}
      />
    </>
  );
}
