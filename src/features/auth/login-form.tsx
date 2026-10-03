"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { FormAlert } from "./form-alert";
import { useAuthErrorMessage, useValidationMessage } from "./use-auth-error";

export function LoginForm({ canResetPassword }: { canResetPassword: boolean }) {
  const t = useTranslations("auth");
  const v = useValidationMessage();
  const toMessage = useAuthErrorMessage();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await authClient.signIn.email(values);
    if (error) {
      setServerError(toMessage(error));
      return;
    }
    router.replace("/home");
    router.refresh();
  });

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
      <Field
        label={t("password")}
        error={v(errors.password?.message)}
        aside={
          canResetPassword ? (
            <Link href="/forgot-password" className="text-small text-accent hover:underline">
              {t("forgot")}
            </Link>
          ) : undefined
        }
      >
        {(a11y) => (
          <PasswordInput
            {...a11y}
            {...register("password")}
            autoComplete="current-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting} className="mt-2">
        {t("login")}
      </Button>
    </form>
  );
}
