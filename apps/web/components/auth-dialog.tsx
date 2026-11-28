"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  ArrowUpRight,
  ChartCandlestick,
  Eye,
  EyeOff,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState, type ReactNode, type InputHTMLAttributes } from "react";
import { useTranslations } from "next-intl";

export function AuthDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop auth-backdrop" />
        <Dialog.Content className="modal-content auth-dialog">
          <aside className="auth-story" aria-hidden="true">
            <div className="auth-brand">
              <span>
                <Activity size={22} />
              </span>
              CryptoSight<span className="auth-brand-ai">AI</span>
            </div>
            <div className="auth-story-copy">
              <span className="auth-eyebrow">{t("authWorkspace")}</span>
              <h2>{t("authStoryTitle")}</h2>
              <p>{t("authStoryDescription")}</p>
            </div>
            <div className="auth-chart-art">
              <div>
                <span>BTC / USDT</span>
                <ChartCandlestick size={17} />
              </div>
              <svg viewBox="0 0 300 130" fill="none">
                <path
                  className="auth-art-grid"
                  d="M0 25H300M0 65H300M0 105H300M50 0V130M150 0V130M250 0V130"
                />
                <path
                  className="auth-art-area"
                  d="M0 108L25 96L48 102L72 72L95 82L118 57L142 69L166 42L188 51L213 22L238 36L265 12L300 20V130H0Z"
                />
                <path
                  className="auth-art-line"
                  d="M0 108L25 96L48 102L72 72L95 82L118 57L142 69L166 42L188 51L213 22L238 36L265 12L300 20"
                />
              </svg>
              <small>{t("authIllustration")}</small>
            </div>
            <div className="auth-story-features">
              <span>
                <ScanLine size={16} />
                {t("authFeatureAnalysis")}
              </span>
              <span>
                <ChartCandlestick size={16} />
                {t("authFeaturePaper")}
              </span>
            </div>
            <p className="auth-story-footer">
              <ArrowUpRight size={15} />
              {t("authStoryFooter")}
            </p>
          </aside>
          <div className="auth-main">
            <div className="auth-mobile-brand">
              <Activity size={19} />
              CryptoSight <span>AI</span>
            </div>
            <header className="auth-heading">
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </header>
            {children}
            <div className="auth-security">
              <ShieldCheck size={14} />
              <span>{t("authSecurity")}</span>
            </div>
          </div>
          <Dialog.Close
            className="icon-button auth-close"
            aria-label={t("close")}
          >
            <X size={19} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function AuthPasswordInput(
  props: InputHTMLAttributes<HTMLInputElement>,
) {
  const [visible, setVisible] = useState(false),
    t = useTranslations();
  return (
    <div className="auth-password">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        aria-label={t(visible ? "authHidePassword" : "authShowPassword")}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
