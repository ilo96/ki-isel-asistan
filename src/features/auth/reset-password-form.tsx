"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { FormAlert } from "./form-alert";
import { useAuthErrorMessage, useValidationMessage } from "./use-auth-error";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const v = useValidationMessage();
  const toMessage = useAuthErrorMessage();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  if (!token) return <FormAlert>{t("resetInvalid")}</FormAlert>;

  if (done) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{t("resetDone")}</FormAlert>
        <Button asChild size="lg" block>
          <Link href="/login">{t("goLogin")}</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setServerError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setServerError(toMessage(error));
      return;
    }
    setDone(true);
  });

  const passwordProps = {
    showLabel: t("showPassword"),
    hideLabel: t("hidePassword"),
    autoComplete: "new-password",
  };
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && <FormAlert>{serverError}</FormAlert>}
      <Field label={t("passwordNew")} hint={t("passwordHint")} error={v(errors.password?.message)}>
        {(a11y) => (
          <PasswordInput {...a11y} {...register("password")} {...passwordProps} autoFocus />
        )}
      </Field>
      <Field label={t("passwordConfirm")} error={v(errors.confirm?.message)}>
        {(a11y) => <PasswordInput {...a11y} {...register("confirm")} {...passwordProps} />}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting}>
        {t("resetSubmit")}
      </Button>
    </form>
  );
}
