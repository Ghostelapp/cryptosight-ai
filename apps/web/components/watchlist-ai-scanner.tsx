"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { api } from "../lib/client";
import { Button } from "./ui/button";
export function WatchlistAIScanner({
  instrument,
  config,
  controls,
  enabled,
  protect,
  onOpen,
  reservation,
}: {
  instrument: any;
  config: any;
  controls: ReactNode;
  enabled: boolean;
  protect: () => boolean;
  onOpen: (row: any) => void;
  reservation?: number;
}) {
  const t = useTranslations(),
    [frames, setFrames] = useState(["15m", "1h", "4h"]),
    [rows, setRows] = useState<any[]>([]),
    [ids, setIds] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const intent = useRef<{ signature: string; key: string } | null>(null),
    root = useRef<HTMLElement>(null),
    epoch = useRef(0);
  const scope = JSON.stringify([instrument.venue, instrument.market, enabled]);
  const query = () =>
    new URLSearchParams({
      mode: "ai",
      venue: instrument.venue,
      market: instrument.market,
    });
  const errorText = (code: string) =>
    t.has("err_" + code) ? t("err_" + code) : t("err_service_unavailable");
  useEffect(() => {
    const current = ++epoch.current;
    setRows([]);
    setIds([]);
    setMessage("");
    if (enabled)
      api("scanner?" + query())
        .then((r) => {
          if (current === epoch.current) setRows(r);
        })
        .catch((e) => {
          if (current === epoch.current) setMessage(errorText(e.message));
        });
    return () => {
      epoch.current++;
    };
  }, [scope]);
  useEffect(() => {
    if (!ids.length) return;
    const abort = new AbortController();
    let pending = false,
      done = false;
    const poll = async () => {
      if (
        done ||
        pending ||
        document.visibilityState === "hidden" ||
        root.current?.closest("[hidden]")
      )
        return;
      pending = true;
      try {
        const q = query();
        q.set("ids", ids.join(","));
        const result = await api("scanner?" + q, { signal: abort.signal });
        if (!done) {
          setRows((old) =>
            old.map((row) => result.find((r: any) => r.id === row.id) || row),
          );
          if (
            ids.every((id) =>
              result.some(
                (r: any) =>
                  r.id === id && ["completed", "failed"].includes(r.status),
              ),
            )
          ) {
            done = true;
            setIds([]);
          }
        }
      } catch (e: any) {
        if (!done) setMessage(errorText(e.message));
      } finally {
        pending = false;
      }
    };
    const timer = setInterval(poll, 3000);
    void poll();
    return () => {
      done = true;
      abort.abort();
      clearInterval(timer);
    };
  }, [ids.join(","), scope]);
  async function scan() {
    if (!protect() || busy || !frames.length) return;
    const body = {
        ...config,
        venue: instrument.venue,
        market: instrument.market,
        timeframe: frames[0],
        timeframes: frames,
        mode: "deep",
      },
      signature = JSON.stringify(body),
      current = epoch.current;
    if (intent.current?.signature !== signature)
      intent.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setMessage("");
    try {
      const result = await api("scanner", {
        method: "POST",
        body,
        headers: { "idempotency-key": intent.current.key },
      });
      if (current !== epoch.current) return;
      intent.current = null;
      setRows(result.jobs);
      setIds(
        result.jobs
          .filter(
            (j: any) => j.id && !["failed", "completed"].includes(j.status),
          )
          .map((j: any) => j.id),
      );
      setMessage(
        result.jobs.length
          ? t("aiBatchSummary", {
              queued: result.enqueued,
              total: result.jobs.length,
            })
          : t("aiWatchlistEmpty"),
      );
    } catch (e: any) {
      if (current === epoch.current) setMessage(errorText(e.message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="form-card watchlist-ai"
      ref={root}
      aria-label={t("watchlistScans")}
    >
      <h2>{t("watchlistScans")}</h2>
      <p className="muted">{t("aiMultiFrameHint")}</p>
      <div className="form-grid">{controls}</div>
      <fieldset className="ai-scan-frames">
        <legend>{t("aiEntryFrames")}</legend>
        {["5m", "15m", "1h", "4h", "1d"].map((f) => (
          <label key={f}>
            <input
              type="checkbox"
              checked={frames.includes(f)}
              disabled={busy || (!frames.includes(f) && frames.length === 3)}
              onChange={(e) =>
                setFrames((old) =>
                  e.target.checked ? [...old, f] : old.filter((x) => x !== f),
                )
              }
            />
            {f}
          </label>
        ))}
      </fieldset>
      <p className="muted">
        {t("aiBatchBudget", { count: 5 * frames.length })}
        {Number.isFinite(reservation)
          ? " · ≤ " +
            (5 * frames.length * Number(reservation)).toFixed(2) +
            " USD"
          : ""}
      </p>
      <div className="paper-actions">
        <Button
          disabled={busy || !frames.length || !config.agentId}
          onClick={() => void scan()}
        >
          {busy ? t("loading") : t("aiScan")}
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            if (!protect()) return;
            try {
              setRows(await api("scanner?" + query()));
            } catch (e: any) {
              setMessage(errorText(e.message));
            }
          }}
        >
          {t("scanResults")}
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      <div className="table-scroll ai-batch-results" tabIndex={0}>
        <table>
          <thead>
            <tr>
              {[
                t("symbol"),
                t("timeframe"),
                t("status"),
                t("direction"),
                t("score"),
                t("details"),
              ].map((label, i) => (
                <th key={i}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || i}>
                <td>
                  {row.symbol}
                  <small className="muted">
                    {" "}
                    · {row.venue} / {row.market}
                  </small>
                </td>
                <td>{row.timeframe}</td>
                <td>
                  {row.error
                    ? errorText(row.error)
                    : t.has(row.status)
                      ? t(row.status)
                      : row.status}
                </td>
                <td>{row.direction || "—"}</td>
                <td>
                  {row.score == null ? "—" : Number(row.score).toFixed(1)}
                </td>
                <td>
                  {row.status === "completed" && (
                    <button className="text-button" onClick={() => onOpen(row)}>
                      {t("openCandidateChart")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
