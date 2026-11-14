"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, ArrowUpRight } from "lucide-react";
import { Modal } from "./ui/dialog";

export type TerminalCommand = {
  id: string;
  label: string;
  detail?: string;
  keywords?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  commands: TerminalCommand[];
}) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);
  const term = query.trim().toLocaleLowerCase();
  const results = commands
    .filter((c) =>
      `${c.label} ${c.detail || ""} ${c.keywords || ""}`
        .toLocaleLowerCase()
        .includes(term),
    )
    .slice(0, 40);
  const execute = (command: TerminalCommand) => {
    onOpenChange(false);
    // Let the palette restore focus before another dialog opens.
    setTimeout(command.run, 0);
  };
  useEffect(() => {
    document
      .getElementById(`command-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("commandPalette")}
      closeLabel={t("close")}
    >
      <div className="command-search">
        <Search size={19} aria-hidden="true" />
        <input
          autoFocus
          aria-label={t("commandSearch")}
          placeholder={t("commandSearch")}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="command-results"
          aria-activedescendant={
            results[active] ? `command-${active}` : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (["ArrowDown", "ArrowUp"].includes(e.key)) {
              e.preventDefault();
              setActive((a) =>
                results.length
                  ? (a + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                    results.length
                  : 0,
              );
            }
            if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              execute(results[active]);
            }
          }}
        />
      </div>
      <div
        id="command-results"
        role="listbox"
        aria-label={t("commandPalette")}
        className="command-results"
      >
        {results.map((command, index) => (
          <div
            key={command.id}
            id={`command-${index}`}
            role="option"
            aria-selected={active === index}
            className="command-option"
            onMouseMove={() => setActive(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execute(command)}
          >
            <span>
              {command.label}
              {command.detail && <small>{command.detail}</small>}
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </div>
        ))}
        {!results.length && (
          <p className="muted command-empty">{t("noCommands")}</p>
        )}
      </div>
      <small className="muted">{t("commandHint")}</small>
    </Modal>
  );
}
