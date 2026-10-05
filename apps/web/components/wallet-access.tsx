"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { api } from "../lib/client";
type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
};
type Choice = { id: string; name: string; provider: Provider };
export function WalletAccess({
  user,
  locale,
  onChanged,
  chains = [],
}: {
  user?: any;
  locale: string;
  chains?: number[];
  onChanged: (action: string) => Promise<void>;
}) {
  const t = useTranslations(),
    [choices, setChoices] = useState<Choice[]>([]),
    [selected, setSelected] = useState(""),
    [consent, setConsent] = useState(false),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [wallets, setWallets] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    const found = new Map<string, Choice>();
    const add = (choice: Choice) => {
      if ([...found.values()].some((x) => x.provider === choice.provider))
        return;
      found.set(choice.id, choice);
      if (active) {
        setChoices([...found.values()]);
        setSelected((old) => old || choice.id);
      }
    };
    const announce = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (
        d?.provider?.request &&
        typeof d.info?.uuid === "string" &&
        typeof d.info?.name === "string"
      )
        add({
          id: d.info.uuid,
          name: d.info.name.slice(0, 80),
          provider: d.provider,
        });
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const eth = (window as any).ethereum;
    if (eth?.request && !found.size)
      add({
        id: "injected",
        name: eth.isMetaMask ? "MetaMask" : t("walletProvider"),
        provider: eth,
      });
    return () => {
      active = false;
      window.removeEventListener("eip6963:announceProvider", announce);
    };
  }, [t]);
  useEffect(() => {
    if (user)
      api("wallets")
        .then(setWallets)
        .catch(() => setWallets([]));
    else setWallets([]);
  }, [user]);
  const sign = async (
    purpose: "auth" | "link" | "unlink",
    expected?: string,
  ) => {
    if (pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const provider = choices.find((x) => x.id === selected)?.provider;
      if (!provider) throw new Error("wallet_unavailable");
      if (purpose === "auth" && !consent) throw new Error("consent_required");
      const accounts = await provider.request({
          method: "eth_requestAccounts",
        }),
        address = expected
          ? accounts.find(
              (a: string) => a.toLowerCase() === expected.toLowerCase(),
            )
          : accounts[0];
      if (typeof address !== "string") throw new Error("wallet_changed");
      const chain = await provider.request({ method: "eth_chainId" }),
        chainId = Number.parseInt(chain, 16);
      const challenge = await api("auth/wallet/challenge", {
        method: "POST",
        body: { address, chainId, purpose, locale },
      });
      const bytes = new TextEncoder().encode(challenge.message),
        hex =
          "0x" +
          Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
      const signature = await provider.request({
        method: "personal_sign",
        params: [hex, address],
      });
      const after = await provider.request({ method: "eth_accounts" }),
        afterChain = await provider.request({ method: "eth_chainId" });
      if (
        !after.some((a: string) => a.toLowerCase() === address.toLowerCase()) ||
        Number.parseInt(afterChain, 16) !== chainId
      )
        throw new Error("wallet_changed");
      const result = await api("auth/wallet/verify", {
        method: "POST",
        body: {
          challengeId: challenge.challengeId,
          message: challenge.message,
          signature,
          consent,
          totp: code,
        },
      });
      setCode("");
      await onChanged(result.action);
      if (purpose === "link") {
        setWallets(await api("wallets"));
        setNotice(t("walletLinked"));
      }
      if (purpose === "unlink") setNotice(t("walletSignedOut"));
    } catch (e: any) {
      const key =
        Number(e.code) === 4001
          ? "wallet_rejected"
          : Number(e.code) === -32002
            ? "wallet_pending"
            : e.message;
      setError(t.has("err_" + key) ? t("err_" + key) : t("errors"));
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="wallet-access form-card" data-testid="wallet-access">
      <h3>
        <Wallet size={17} />
        {user ? t("wallets") : t("walletLogin")}
      </h3>
      <p className="muted">{t("walletHint")}</p>
      {chains.length > 0 && (
        <p className="muted">
          {t("walletNetworks", {
            chains: chains
              .map(
                (id) =>
                  (
                    ({
                      1: "Ethereum",
                      8453: "Base",
                      137: "Polygon",
                      42161: "Arbitrum",
                      10: "Optimism",
                      43114: "Avalanche",
                      56: "BNB Chain",
                      84532: "Base Sepolia",
                      11155111: "Ethereum Sepolia",
                    }) as Record<number, string>
                  )[id] || String(id),
              )
              .join(", "),
          })}
        </p>
      )}
      {choices.length ? (
        <label className="field">
          <span>{t("walletProvider")}</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending}
          >
            {choices.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p role="status">{t("walletNone")}</p>
      )}
      {(!user || user.two_factor) && (
        <label className="field">
          <span>{t("totpCode")}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
          />
        </label>
      )}
      {!user && (
        <label className="wallet-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>{t("walletConsent")}</span>
        </label>
      )}
      <Button
        disabled={pending || !choices.length || (!user && !consent)}
        onClick={() => sign(user ? "link" : "auth")}
      >
        {pending ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Wallet size={16} />
        )}{" "}
        {user ? t("walletLink") : t("walletLogin")}
      </Button>
      {user &&
        wallets.map((w) => (
          <div className="wallet-row" key={w.id}>
            <code>{w.address}</code>
            <Button
              variant="outline"
              disabled={pending || !choices.length}
              onClick={() => sign("unlink", w.address)}
            >
              {t("walletUnlink")}
            </Button>
          </div>
        ))}
      {user && wallets.length === 1 && !user.has_password && (
        <p className="muted">{t("walletLastMethod")}</p>
      )}
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="positive">
          {notice}
        </p>
      )}
    </section>
  );
}
