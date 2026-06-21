"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

export const DiscardDialogContext = createContext<{
  setDirty: (dirty: boolean) => void;
} | null>(null);

export function useDiscardDialog() {
  return useContext(DiscardDialogContext);
}

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
  const isDirtyRef = useRef(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isOpen = externalOpen === undefined ? internalOpen : externalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirtyRef.current) {
      setShowDiscardConfirm(true);
      return;
    }

    if (externalOnOpenChange) {
      externalOnOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }

    if (!newOpen) {
      isDirtyRef.current = false;
    }
  };

  const handleConfirmDiscard = () => {
    isDirtyRef.current = false;
    if (externalOnOpenChange) {
      externalOnOpenChange(false);
    } else {
      setInternalOpen(false);
    }
  };

  const setDirty = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

  return (
    <DiscardDialogContext.Provider value={{ setDirty }}>
      <Dialog onOpenChange={handleOpenChange} open={isOpen}>
        {trigger}
        <DialogContent className={className}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div
            className="flex flex-1 flex-col overflow-hidden"
            onChange={() => {
              isDirtyRef.current = true;
            }}
          >
            {children}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDiscardDialog
        onConfirm={handleConfirmDiscard}
        onOpenChange={setShowDiscardConfirm}
        open={showDiscardConfirm}
      />
    </DiscardDialogContext.Provider>
  );
}
