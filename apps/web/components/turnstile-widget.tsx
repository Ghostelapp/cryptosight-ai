"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
let loading: Promise<void> | null = null;
function load() {
  if ((window as any).turnstile) return Promise.resolve();
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        loading = null;
        reject(new Error("captcha_unavailable"));
      };
      document.head.append(script);
    });
  return loading;
}
export function TurnstileWidget({
  active,
  siteKey,
  action,
  revision,
  locale,
  onToken,
}: {
  active: boolean;
  siteKey?: string;
  action: string;
  revision: number;
  locale: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0),
    t = useTranslations();
  useEffect(() => {
    onToken("");
    setFailed(false);
    if (!active) return;
    if (!siteKey) {
      setFailed(true);
      return;
    }
    let dead = false,
      id: string | undefined;
    load()
      .then(() => {
        if (dead || !ref.current) return;
        id = (window as any).turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          language: locale,
          theme: "auto",
          size: ref.current.clientWidth < 300 ? "compact" : "flexible",
          callback: (token: string) => {
            if (!dead) onToken(token);
          },
          "expired-callback": () => {
            if (!dead) onToken("");
          },
          "error-callback": () => {
            if (!dead) {
              onToken("");
              setFailed(true);
            }
          },
        });
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
      if (id) (window as any).turnstile?.remove(id);
    };
  }, [active, siteKey, action, revision, locale, retry, onToken]);
  if (!active) return null;
  return (
    <div className="turnstile-area">
      <div ref={ref} />
      {failed && (
        <p role="alert">
          {t("captchaUnavailable")}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            {t("retry")}
          </button>
        </p>
      )}
    </div>
  );
}
