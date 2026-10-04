"use client";

import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ComponentType } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { duration, ease, spring } from "@/lib/motion";
import { PersonalizeForm } from "./personalize-form";
import { AssistantArt, MoneyArt, RemindArt } from "./slide-art";

const ARTS: ComponentType[] = [AssistantArt, MoneyArt, RemindArt];
const SLIDE_COUNT = ARTS.length;
const TOTAL = SLIDE_COUNT + 1;
/** Bu kadar piksel veya hızla kaydırılırsa sonraki karta geçilir. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

/**
 * Plan: Kullanıcı akışları > İlk açılış. Üç kaydırılabilir tanıtım kartı ("Atla" her zaman
 * görünür) ve tek sayfalık kişiselleştirme adımı.
 */
export function OnboardingFlow({ defaultName }: { defaultName: string }) {
  const t = useTranslations("onboarding");
  const [[step, direction], setStep] = useState<[number, number]>([0, 1]);
  const isForm = step === SLIDE_COUNT;

  const go = (next: number) => {
    if (next < 0 || next > SLIDE_COUNT) return;
    setStep([next, next > step ? 1 : -1]);
  };

  useEffect(() => {
    if (isForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) go(step + 1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) go(step - 1);
  };

  const slides = t.raw("slides") as { title: string; body: string }[];
  const slide = slides[step];
  const Art = ARTS[step];

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 size-[560px] -translate-x-1/2 rounded-full ai-gradient opacity-[0.12] blur-3xl dark:opacity-[0.18]"
      />

      <header className="relative mx-auto flex h-16 w-full max-w-[560px] items-center justify-between px-4">
        {step > 0 ? (
          <Button variant="ghost" size="icon" onClick={() => go(step - 1)} aria-label={t("back")}>
            <ArrowLeft />
          </Button>
        ) : (
          <BrandMark size="sm" />
        )}
        <Progress step={step} label={t("step", { current: step + 1, total: TOTAL })} />
        {isForm ? (
          <span className="w-11" />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => go(SLIDE_COUNT)}>
            {t("skip")}
          </Button>
        )}
      </header>

      <main
        id="main"
        className="relative mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-8"
      >
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={step}
            custom={direction}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 40 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -40 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: duration.page, ease }}
            drag={isForm ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            aria-roledescription={isForm ? undefined : "slide"}
            className={cn(
              "flex flex-1 flex-col",
              !isForm && "cursor-grab touch-pan-y active:cursor-grabbing",
            )}
          >
            {isForm ? (
              <div className="pt-4">
                <h1 className="text-h1 text-text">{t("personalTitle")}</h1>
                <p className="mt-2 mb-8 text-body text-muted">{t("personalSubtitle")}</p>
                <PersonalizeForm defaultName={defaultName} />
              </div>
            ) : (
              <>
                <div className="flex flex-1 items-center py-8 select-none">{Art && <Art />}</div>
                <div className="text-center">
                  <h1 className="text-h1 text-text">{slide?.title}</h1>
                  <p className="mx-auto mt-3 max-w-sm text-body text-muted">{slide?.body}</p>
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>

        {!isForm && (
          <Button size="lg" block className="mt-10" onClick={() => go(step + 1)}>
            {step === SLIDE_COUNT - 1 ? t("start") : t("next")}
          </Button>
        )}
      </main>
    </div>
  );
}

function Progress({ step, label }: { step: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={TOTAL}
      aria-valuenow={step + 1}
      className="flex items-center gap-1.5"
    >
      {Array.from({ length: TOTAL }, (_, i) => (
        <span key={i} className="relative h-1.5 w-6 overflow-hidden rounded-full bg-surface-muted">
          {i <= step && (
            <motion.span
              layoutId={i === step ? "onboarding-progress" : undefined}
              transition={spring.layout}
              className="absolute inset-0 rounded-full bg-accent"
            />
          )}
        </span>
      ))}
    </div>
  );
}
