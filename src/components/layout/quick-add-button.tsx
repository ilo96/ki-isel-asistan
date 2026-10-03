"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useShell } from "./ui-store";

/** Server sayfalarından Hızlı ekle sheet'ini açan buton. */
export function QuickAddButton(props: Omit<ButtonProps, "onClick">) {
  const { open } = useShell();
  return <Button {...props} onClick={() => open("quickAdd")} />;
}
