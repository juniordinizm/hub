"use client";

import {
  AdminMutationForm,
  type AdminMutationFormProps,
} from "./admin-mutation-form";

export function AutoCloseDialogForm({
  ...props
}: Omit<AdminMutationFormProps, "closeOnSuccess">): React.JSX.Element {
  return <AdminMutationForm {...props} closeOnSuccess />;
}
