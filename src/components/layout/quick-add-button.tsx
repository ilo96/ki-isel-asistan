"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import type { TransactionType } from "@/lib/finance/types";
import { useShell } from "./ui-store";

/** Server sayfalarından Hızlı ekle sheet'ini açan buton. */
export function QuickAddButton({
  kind,
  ...props
}: Omit<ButtonProps, "onClick"> & { kind?: TransactionType }) {
  const { open } = useShell();
  return <Button {...props} onClick={() => open("quickAdd", { kind })} />;
}
