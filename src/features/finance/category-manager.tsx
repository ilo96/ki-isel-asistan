"use client";

import { Archive, ArchiveRestore, Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { CategoryIcon, categoryIconComponent } from "@/features/dashboard/category-icon";
import { FormAlert } from "@/features/auth/form-alert";
import { useValidationMessage } from "@/features/auth/use-auth-error";
import { cn } from "@/lib/cn";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type CategoryColor,
  type CategoryIcon as IconName,
} from "@/lib/finance/categories";
import type { CategoryOption, TransactionType } from "@/lib/finance/types";
import { categoryInputSchema } from "@/lib/validation/finance";
import { archiveCategoryAction, saveCategoryAction, type ActionError } from "./actions";

const SWATCHES: Record<CategoryColor, string> = {
  "cat-1": "bg-cat-1",
  "cat-2": "bg-cat-2",
  "cat-3": "bg-cat-3",
  "cat-4": "bg-cat-4",
  "cat-5": "bg-cat-5",
  "cat-6": "bg-cat-6",
  "cat-7": "bg-cat-7",
  "cat-8": "bg-cat-8",
};

type Editing = { category: CategoryOption | null; type: TransactionType };

/** Kategori listesi; ekleme ve düzenleme aynı sheet'te. Silme yok, arşiv var. */
export function CategoryManager({ categories }: { categories: CategoryOption[] }) {
  const t = useTranslations("categories");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [open, setOpen] = useState(false);
  const archived = categories.filter((c) => c.archived);

  const start = (next: Editing) => {
    setEditing(next);
    setOpen(true);
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {(["expense", "income"] as const).map((type) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{t(type)}</CardTitle>
              <Button variant="soft" size="sm" onClick={() => start({ category: null, type })}>
                <Plus aria-hidden />
                {t("add")}
              </Button>
            </CardHeader>
            <ul className="-mx-2">
              {categories
                .filter((c) => c.type === type && !c.archived)
                .map((c) => (
                  <li key={c.id}>
                    <CategoryRow category={c} onClick={() => start({ category: c, type })} />
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>

      {archived.length > 0 && (
        <Card className="mt-4 lg:mt-6">
          <CardHeader>
            <CardTitle>{t("archived")}</CardTitle>
          </CardHeader>
          <p className="-mt-2 mb-3 text-small text-muted">{t("archivedHint")}</p>
          <ul className="-mx-2">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1 opacity-70">
                  <CategoryRow category={c} onClick={() => start({ category: c, type: c.type })} />
                </div>
                <RestoreButton id={c.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={editing?.category ? t("editTitle") : t("addTitle")}
        closeLabel={t("close")}
      >
        {editing && (
          <CategoryForm
            key={editing.category?.id ?? `new-${editing.type}`}
            editing={editing}
            onDone={() => setOpen(false)}
          />
        )}
      </Sheet>
    </>
  );
}

function CategoryRow({ category, onClick }: { category: CategoryOption; onClick: () => void }) {
  const t = useTranslations("categories");
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left transition-colors hover:bg-surface-muted"
    >
      <CategoryIcon icon={category.icon} colorToken={category.colorToken} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-text">{category.name}</span>
        <span className="block text-small text-muted">{t("usage", { count: category.usage })}</span>
      </span>
    </button>
  );
}

function RestoreButton({ id }: { id: string }) {
  const t = useTranslations("categories");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await archiveCategoryAction(id, false);
          toast(
            result.ok
              ? { message: t("restored") }
              : { message: t("errors.unknown"), tone: "error" },
          );
        })
      }
    >
      <ArchiveRestore aria-hidden />
      {t("restore")}
    </Button>
  );
}

function CategoryForm({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  const t = useTranslations("categories");
  const tq = useTranslations("quickAdd");
  const v = useValidationMessage();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const current = editing.category;
  const [type, setType] = useState<TransactionType>(editing.type);
  const [name, setName] = useState(current?.name ?? "");
  const [icon, setIcon] = useState<IconName>(
    (CATEGORY_ICONS as readonly string[]).includes(current?.icon ?? "")
      ? (current!.icon as IconName)
      : "ellipsis",
  );
  const [color, setColor] = useState<CategoryColor>(
    (CATEGORY_COLORS as readonly string[]).includes(current?.colorToken ?? "")
      ? (current!.colorToken as CategoryColor)
      : "cat-1",
  );
  const [nameError, setNameError] = useState<string>();
  const [serverError, setServerError] = useState<ActionError | null>(null);

  const errorText = (code: ActionError) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.unknown");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = categoryInputSchema.safeParse({ type, name, icon, colorToken: color });
    if (!parsed.success) {
      setNameError(v(parsed.error.issues[0]?.message));
      return;
    }
    setNameError(undefined);
    setServerError(null);
    startTransition(async () => {
      const result = await saveCategoryAction(current?.id ?? null, parsed.data);
      if (!result.ok) return setServerError(result.error);
      onDone();
      toast({ message: t(current ? "saved" : "created") });
    });
  };

  const archive = () =>
    startTransition(async () => {
      if (!current) return;
      const result = await archiveCategoryAction(current.id, !current.archived);
      if (!result.ok) return setServerError(result.error);
      onDone();
      toast({
        message: t(current.archived ? "restored" : "archivedToast"),
        action: current.archived
          ? undefined
          : {
              label: t("undo"),
              onClick: () => void archiveCategoryAction(current.id, false),
            },
      });
    });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {serverError && <FormAlert>{errorText(serverError)}</FormAlert>}

      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} colorToken={color} className="size-12" />
        <Field label={t("name")} error={nameError} className="flex-1">
          {(a11y) => (
            <Input
              {...a11y}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={40}
              autoFocus={!current}
            />
          )}
        </Field>
      </div>

      {!current && (
        <SegmentedControl
          label={t("type")}
          value={type}
          onChange={setType}
          options={[
            { value: "expense", label: tq("expense") },
            { value: "income", label: tq("income") },
          ]}
          className="flex w-full"
        />
      )}

      <fieldset>
        <legend className="mb-2 text-small text-text">{t("icon")}</legend>
        <div
          role="radiogroup"
          aria-label={t("icon")}
          className="grid grid-cols-6 gap-2 sm:grid-cols-8"
        >
          {CATEGORY_ICONS.map((name) => {
            const Icon = categoryIconComponent(name);
            const active = name === icon;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t(`icons.${name}`)}
                onClick={() => setIcon(name)}
                className={cn(
                  "grid aspect-square place-items-center rounded-input border transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted hover:text-text",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-small text-text">{t("color")}</legend>
        <div role="radiogroup" aria-label={t("color")} className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c, i) => {
            const active = c === color;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t("colorN", { n: i + 1 })}
                onClick={() => setColor(c)}
                className={cn(
                  "grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-surface-raised transition-shadow",
                  SWATCHES[c],
                  active && "ring-2 ring-text",
                )}
              >
                {active && <Check className="size-4 text-on-accent" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex gap-3">
        {current && (
          <Button type="button" variant="secondary" size="lg" onClick={archive} disabled={pending}>
            {current.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {current.archived ? t("restore") : t("archive")}
          </Button>
        )}
        <Button type="submit" size="lg" block loading={pending} className="flex-1">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
