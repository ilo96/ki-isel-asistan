"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { FormAlert } from "./form-alert";
import { useAuthErrorMessage, useValidationMessage } from "./use-auth-error";

export function RegisterForm() {
  const t = useTranslations("auth");
  const v = useValidationMessage();
  const toMessage = useAuthErrorMessage();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await authClient.signUp.email(values);
    if (error) {
      setServerError(toMessage(error));
      return;
    }
    router.replace("/onboarding");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && <FormAlert>{serverError}</FormAlert>}
      <Field label={t("name")} error={v(errors.name?.message)}>
        {(a11y) => (
          <Input
            {...a11y}
            {...register("name")}
            autoComplete="given-name"
            placeholder={t("namePlaceholder")}
            autoFocus
          />
        )}
      </Field>
      <Field label={t("email")} error={v(errors.email?.message)}>
        {(a11y) => (
          <Input
            {...a11y}
            {...register("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
          />
        )}
      </Field>
      <Field label={t("password")} hint={t("passwordHint")} error={v(errors.password?.message)}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            {...register("password")}
            autoComplete="new-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting} className="mt-2">
        {t("register")}
      </Button>
      <p className="text-center text-caption text-muted">{t("terms")}</p>
    </form>
  );
}
