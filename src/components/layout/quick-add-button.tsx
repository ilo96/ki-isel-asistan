"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useShell, type QuickAddKind } from "./ui-store";

/** Server sayfalarından Hızlı ekle sheet'ini açan buton. */
export function QuickAddButton({
  kind,
  ...props
}: Omit<ButtonProps, "onClick"> & { kind?: QuickAddKind }) {
  const { open } = useShell();
  return <Button {...props} onClick={() => open("quickAdd", { kind })} />;
}
