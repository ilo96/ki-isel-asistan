"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { FormAlert } from "./form-alert";
import { useAuthErrorMessage, useValidationMessage } from "./use-auth-error";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const v = useValidationMessage();
  const toMessage = useAuthErrorMessage();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setServerError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    // Hesabın var olup olmadığını belli etmemek için başarı mesajı her durumda aynıdır.
    if (error && error.status === 429) {
      setServerError(toMessage(error));
      return;
    }
    setSent(true);
  });

  if (sent) return <FormAlert tone="success">{t("forgotSent")}</FormAlert>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && <FormAlert>{serverError}</FormAlert>}
      <Field label={t("email")} error={v(errors.email?.message)}>
        {(a11y) => (
          <Input
            {...a11y}
            {...register("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            autoFocus
          />
        )}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting}>
        {t("forgotSubmit")}
      </Button>
    </form>
  );
}
