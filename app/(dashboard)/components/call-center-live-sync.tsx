"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

function isEditingElement(element: Element | null) {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.getAttribute("contenteditable") === "true"
  );
}

export function CallCenterLiveSync({ intervalMs = 6000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (isEditingElement(document.activeElement)) return;

      const now = Date.now();
      if (now - lastRefreshAt.current < intervalMs - 500) return;
      lastRefreshAt.current = now;

      startTransition(() => {
        router.refresh();
      });
    };

    const interval = window.setInterval(refresh, intervalMs);
    const onFocus = () => refresh();

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs, router, startTransition]);

  return null;
}
