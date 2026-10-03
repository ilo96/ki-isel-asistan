"use client";

import { useEffect, useState } from "react";
import { getQuickAddDataAction, type QuickAddData } from "./actions";

/**
 * Sheet her açıldığında kategorileri tazeler. Önceki veri varsa beklemeden onu gösterir;
 * böylece ikinci açılışta form anında gelir.
 */
export function useQuickAddData(open: boolean) {
  const [data, setData] = useState<QuickAddData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFailed(false);
    getQuickAddDataAction()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setData(result.data);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  return { data, failed: failed && !data, retry: () => setAttempt((a) => a + 1) };
}
