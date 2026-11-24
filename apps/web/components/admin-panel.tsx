"use client";
import { ModelPicker } from "./model-picker";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
type Agent = {
  id?: string;
  name: string;
  provider: string;
  model: string;
  description: string;
  instructions: string;
  enabled: boolean;
  min_tier: string;
  version?: number;
  has_key?: boolean;
};
const emptyAgent: Agent = {
  name: "",
  provider: "openai",
  model: "",
  description: "",
  instructions: "",
  enabled: false,
  min_tier: "free",
};
function Field({ label, children }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function AdminPanel({ api, user, onChanged }: any) {
  const t = useTranslations();
  const [section, setSection] = useState("agents"),
    [overview, setOverview] = useState<any>(null),
    [agents, setAgents] = useState<Agent[]>([]),
    [agent, setAgent] = useState<Agent>({ ...emptyAgent }),
    [apiKey, setApiKey] = useState(""),
    [clearKey, setClearKey] = useState(false),
    [settings, setSettings] = useState<any>(null),
    [users, setUsers] = useState<any>({ items: [], page: 1, total: 0 }),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [auditPage, setAuditPage] = useState(1),
    [audit, setAudit] = useState<any[]>([]),
    [jobs, setJobs] = useState<any[]>([]),
    [totp, setTotp] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [pendingDelete, setPendingDelete] = useState<Agent | null>(null);
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(user.locale, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: user.timezone,
    }).format(new Date(value));
  const number = (value: any) =>
    new Intl.NumberFormat(user.locale, { maximumFractionDigits: 4 }).format(
      Number(value || 0),
    );
  const refresh = async () => {
    const o = await api("admin/overview");
    setOverview(o);
    setSettings(o.settings);
    if (section === "agents") setAgents(await api("admin/agents"));
    if (section === "users")
      setUsers(
        await api(
          `admin/users?page=${page}&search=${encodeURIComponent(search)}`,
        ),
      );
    if (section === "jobs") setJobs(await api("admin/jobs"));
    if (section === "audit")
      setAudit((await api(`admin/audit?page=${auditPage}`)).items);
  };
  const perform = async (fn: () => Promise<any>, success = "saved") => {
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      await fn();
      await refresh();
      await onChanged();
      setMessage(t(success));
    } catch (e: any) {
      setError(true);
      setMessage(t.has(e.message) ? t(e.message) : t("errors"));
    } finally {
      setBusy(false);
      setTotp("");
    }
  };
  useEffect(() => {
    let active = true;
    setBusy(true);
    setMessage("");
    refresh()
      .catch((e) => {
        if (active) {
          setError(true);
          setMessage(t.has(e.message) ? t(e.message) : t("errors"));
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [section, page, auditPage]);
  const write = (path: string, method: string, body: any) =>
    api(path, {
      method,
      body: { ...body, ...(user.two_factor ? { totp } : {}) },
    });
  const change = (key: string, value: any) =>
    setAgent((a) => ({ ...a, [key]: value }));
  const reset = () => {
    setAgent({ ...emptyAgent });
    setApiKey("");
    setClearKey(false);
  };
  return (
    <section className="admin-panel" aria-busy={busy}>
      <div className="page-title">
        <div>
          <span className="eyebrow">CryptoSight AI</span>
          <h1>{t("admin")}</h1>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => perform(async () => {}, "adminRefreshed")}
        >
          {t("refresh")}
        </Button>
      </div>
      <p className="muted">{t("adminHint")}</p>
      {overview && (
        <div className="stats-grid">
          {[
            ["adminUsers", overview.stats.users],
            ["adminActiveAgents", overview.stats.active_agents],
            ["adminQueued", overview.stats.queued],
            ["adminCostToday", number(overview.stats.cost_today_usd) + " USD"],
          ].map(([key, value]) => (
            <div className="stat" key={key}>
              <span>{t(key)}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="admin-tabs" role="tablist" aria-label={t("admin")}>
        {["agents", "users", "settings", "jobs", "audit"].map((s) => (
          <button
            key={s}
            role="tab"
            tabIndex={section === s ? 0 : -1}
            onKeyDown={(event) => {
              const tabs = ["agents", "users", "settings", "jobs", "audit"],
                index = tabs.indexOf(s);
              const next =
                event.key === "ArrowRight"
                  ? tabs[(index + 1) % tabs.length]
                  : event.key === "ArrowLeft"
                    ? tabs[(index + tabs.length - 1) % tabs.length]
                    : event.key === "Home"
                      ? tabs[0]
                      : event.key === "End"
                        ? tabs.at(-1)
                        : null;
              if (next) {
                event.preventDefault();
                setSection(next);
                document.getElementById("admin-tab-" + next)?.focus();
              }
            }}
            aria-selected={section === s}
            aria-controls={"admin-" + s}
            id={"admin-tab-" + s}
            onClick={() => setSection(s)}
          >
            {t("admin" + s[0].toUpperCase() + s.slice(1))}
          </button>
        ))}
      </div>
      {user.two_factor && (
        <Field label={t("adminTotp")}>
          <input
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
          />
        </Field>
      )}
      {busy && (
        <p role="status" className="muted">
          {t("loading")}
        </p>
      )}
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={error ? "negative" : "positive"}
        >
          {message}
        </p>
      )}
      <div
        role="tabpanel"
        id={"admin-" + section}
        aria-labelledby={"admin-tab-" + section}
      >
        {section === "agents" && (
          <div className="settings-grid admin-agent-grid">
            <div className="form-card">
              <h2>{agent.id ? t("adminEditAgent") : t("adminNewAgent")}</h2>
              <div className="form-grid">
                <Field label={t("name")}>
                  <input
                    value={agent.name}
                    onChange={(e) => change("name", e.target.value)}
                    maxLength={80}
                  />
                </Field>
                <Field label={t("provider")}>
                  <select
                    value={agent.provider}
                    onChange={(e) => {
                      change("provider", e.target.value);
                      change("model", "");
                      setApiKey("");
                    }}
                  >
                    {[
                      "openai",
                      "gemini",
                      "anthropic",
                      "openrouter",
                      "local",
                    ].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <div className="field">
                  <span>{t("model")}</span>
                  <ModelPicker
                    provider={agent.provider}
                    value={agent.model}
                    onChange={(value) => change("model", value)}
                    apiKey={apiKey}
                    agentId={agent.has_key ? agent.id : undefined}
                    automatic={false}
                  />
                </div>
                <Field label={t("adminMinTier")}>
                  <select
                    value={agent.min_tier}
                    onChange={(e) => change("min_tier", e.target.value)}
                  >
                    <option value="free">{t("adminAllUsers")}</option>
                    <option value="pro">{t("adminProOnly")}</option>
                  </select>
                </Field>
              </div>
              <Field label={t("adminDescription")}>
                <textarea
                  value={agent.description}
                  onChange={(e) => change("description", e.target.value)}
                  maxLength={500}
                />
              </Field>
              <Field label={t("adminInstructions")}>
                <textarea
                  value={agent.instructions}
                  onChange={(e) => change("instructions", e.target.value)}
                  maxLength={2000}
                />
              </Field>
              <p className="muted">{t("adminInstructionsHint")}</p>
              {agent.provider !== "local" && (
                <>
                  <Field label={t("apiKey")}>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="new-password"
                      placeholder={
                        agent.has_key
                          ? t("adminKeyStored")
                          : t("adminKeyRequired")
                      }
                    />
                  </Field>
                  <p className="muted">{t("adminKeyHint")}</p>
                  {agent.has_key && (
                    <label className="wallet-consent">
                      <input
                        type="checkbox"
                        checked={clearKey}
                        onChange={(e) => setClearKey(e.target.checked)}
                      />
                      {t("adminRemoveKey")}
                    </label>
                  )}
                </>
              )}
              {agent.provider === "local" && (
                <p className="event-notice">{t("adminLocalHint")}</p>
              )}
              <label className="wallet-consent">
                <input
                  type="checkbox"
                  checked={agent.enabled}
                  onChange={(e) => change("enabled", e.target.checked)}
                />
                {t("adminEnabled")}
              </label>
              <div className="admin-actions">
                <Button
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      const { id, has_key, ...payload } = agent;
                      await write(
                        id ? "admin/agents/" + id : "admin/agents",
                        id ? "PUT" : "POST",
                        { ...payload, clearKey, ...(apiKey ? { apiKey } : {}) },
                      );
                      reset();
                    })
                  }
                >
                  {t("save")}
                </Button>
                <Button variant="outline" onClick={reset}>
                  {t("adminNewAgent")}
                </Button>
              </div>
            </div>
            <div>
              <h2>{t("adminAgents")}</h2>
              {agents.length === 0 && (
                <p className="event-notice">{t("adminNoAgents")}</p>
              )}
              {agents.map((a) => (
                <div className="form-card" key={a.id}>
                  <h2>{a.name}</h2>
                  <p>{a.description}</p>
                  <small>
                    {a.provider} · {a.model} ·{" "}
                    {a.enabled ? t("adminEnabled") : t("adminDisabled")} ·{" "}
                    {a.min_tier === "pro"
                      ? t("adminProOnly")
                      : t("adminAllUsers")}
                  </small>
                  <p className="muted">
                    {a.has_key ? t("adminKeyStored") : t("adminNoKey")}
                  </p>
                  <div className="admin-actions">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setAgent({
                          id: a.id,
                          name: a.name,
                          provider: a.provider,
                          model: a.model,
                          description: a.description,
                          instructions: a.instructions,
                          enabled: a.enabled,
                          min_tier: a.min_tier,
                          version: a.version,
                          has_key: a.has_key,
                        });
                        setApiKey("");
                        setClearKey(false);
                      }}
                    >
                      {t("edit")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || (!a.has_key && a.provider !== "local")}
                      onClick={() =>
                        perform(async () => {
                          await write("admin/agent-tests", "POST", {
                            agentId: a.id,
                          });
                        }, "adminTestPassed")
                      }
                    >
                      {t("adminTestAgent")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setPendingDelete(a)}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {section === "settings" && settings && (
          <div className="form-card">
            <h2>{t("adminSettings")}</h2>
            <label className="wallet-consent">
              <input
                type="checkbox"
                checked={settings.ai_enabled}
                onChange={(e) =>
                  setSettings({ ...settings, ai_enabled: e.target.checked })
                }
              />
              {t("adminAIEnabled")}
            </label>
            <p className="muted">{t("adminPauseHint")}</p>
            <div className="form-grid">
              {[
                "free_daily_limit",
                "pro_daily_limit",
                "free_daily_budget_usd",
                "pro_daily_budget_usd",
              ].map((k) => (
                <Field key={k} label={t("admin_" + k)}>
                  <input
                    type="number"
                    value={settings[k]}
                    min={0}
                    max={10000}
                    step={k.includes("budget") ? "0.01" : "1"}
                    onChange={(e) =>
                      setSettings({ ...settings, [k]: Number(e.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
            <h2>{t("adminAnnouncement")}</h2>
            {["en", "pl", "de"].map((l) => (
              <Field key={l} label={t("language") + " · " + l.toUpperCase()}>
                <textarea
                  maxLength={500}
                  value={settings.announcement[l]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      announcement: {
                        ...settings.announcement,
                        [l]: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            ))}
            <Button
              disabled={busy}
              onClick={() =>
                perform(() => write("admin/settings", "PUT", settings))
              }
            >
              {t("save")}
            </Button>
          </div>
        )}
        {section === "users" && (
          <>
            <div className="form-row">
              <Field label={t("adminSearchUsers")}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  maxLength={254}
                />
              </Field>
              <Button
                disabled={busy}
                onClick={() => {
                  if (page !== 1) setPage(1);
                  else perform(async () => {}, "adminRefreshed");
                }}
              >
                {t("adminSearch")}
              </Button>
            </div>
            <p className="muted">{t("adminSessionsHint")}</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {["adminUsers", "adminRole", "adminSuspended", "save"].map(
                      (k) => (
                        <th key={k}>{t(k)}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((u: any) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.email || u.wallet_address || u.id}</strong>
                        <br />
                        <small>
                          {u.id} · {u.tier}
                        </small>
                      </td>
                      <td>
                        <select
                          aria-label={t("adminRole") + " " + u.id}
                          value={u.role}
                          disabled={u.id === user.id || busy}
                          onChange={(e) =>
                            setUsers({
                              ...users,
                              items: users.items.map((v: any) =>
                                v.id === u.id
                                  ? { ...v, role: e.target.value }
                                  : v,
                              ),
                            })
                          }
                        >
                          <option value="user">{t("adminUser")}</option>
                          <option value="admin">{t("admin")}</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={t("adminSuspended") + " " + u.id}
                          checked={u.suspended}
                          disabled={u.id === user.id || busy}
                          onChange={(e) =>
                            setUsers({
                              ...users,
                              items: users.items.map((v: any) =>
                                v.id === u.id
                                  ? { ...v, suspended: e.target.checked }
                                  : v,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <Button
                          disabled={busy || u.id === user.id}
                          onClick={() =>
                            perform(() =>
                              write("admin/users/" + u.id, "PATCH", {
                                role: u.role,
                                suspended: u.suspended,
                              }),
                            )
                          }
                        >
                          {t("save")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-actions">
              <Button
                variant="outline"
                disabled={page <= 1 || busy}
                onClick={() => setPage(page - 1)}
              >
                {t("adminPrevious")}
              </Button>
              <span>
                {number(page)} · {number(users.total)} {t("adminUsers")}
              </span>
              <Button
                variant="outline"
                disabled={page * 25 >= users.total || busy}
                onClick={() => setPage(page + 1)}
              >
                {t("adminNext")}
              </Button>
            </div>
          </>
        )}
        {section === "jobs" && (
          <>
            <p className="muted">{t("adminJobsHint")}</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "status",
                      "model",
                      "adminUsers",
                      "date",
                      "adminCancelJob",
                    ].map((k) => (
                      <th key={k}>{t(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td>
                        {t.has(j.status) ? t(j.status) : j.status}
                        <br />
                        <small>
                          {j.error_code && t.has(j.error_code)
                            ? t(j.error_code)
                            : j.error_code}
                        </small>
                      </td>
                      <td>
                        {j.provider} · {j.model}
                      </td>
                      <td>
                        <small>{j.user_id}</small>
                      </td>
                      <td>{formatDate(j.created_at)}</td>
                      <td>
                        <Button
                          variant="outline"
                          disabled={busy || j.status !== "queued"}
                          onClick={() =>
                            perform(() =>
                              write("admin/job-cancellations", "POST", {
                                id: j.id,
                              }),
                            )
                          }
                        >
                          {t("adminCancelJob")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {section === "audit" && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {["date", "adminAction", "adminUsers", "adminResource"].map(
                      (k) => (
                        <th key={k}>{t(k)}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDate(a.created_at)}</td>
                      <td>
                        <code>{a.action}</code>
                      </td>
                      <td>
                        <small>{a.user_id || "—"}</small>
                      </td>
                      <td>
                        <small>{a.resource_id || "—"}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-actions">
              <Button
                variant="outline"
                disabled={auditPage <= 1 || busy}
                onClick={() => setAuditPage(auditPage - 1)}
              >
                {t("adminPrevious")}
              </Button>
              <span>{number(auditPage)}</span>
              <Button
                variant="outline"
                disabled={audit.length < 50 || busy}
                onClick={() => setAuditPage(auditPage + 1)}
              >
                {t("adminNext")}
              </Button>
            </div>
          </>
        )}
      </div>
      <Modal
        open={!!pendingDelete}
        onOpenChange={() => setPendingDelete(null)}
        title={t("delete")}
        closeLabel={t("close")}
      >
        <p>{t("adminDeleteAgentHint")}</p>
        <strong>{pendingDelete?.name}</strong>
        <Button
          disabled={busy}
          className="danger"
          onClick={() =>
            perform(async () => {
              await write("admin/agents/" + pendingDelete?.id, "DELETE", {
                version: pendingDelete?.version,
              });
              if (agent.id === pendingDelete?.id) reset();
              setPendingDelete(null);
            })
          }
        >
          {t("delete")}
        </Button>
      </Modal>
    </section>
  );
}
