"use client";
import { Children, useId, useState, type ReactNode } from "react";

export function PageTabs({
  name,
  labels,
  children,
  value,
  onChange,
}: {
  name: string;
  labels: string[];
  children: ReactNode;
  value?: number;
  onChange?: (index: number) => void;
}) {
  const [selected, setSelected] = useState(0),
    id = useId();
  const panels = Children.toArray(children),
    active = value ?? selected;
  const choose = (index: number) => {
    setSelected(index);
    onChange?.(index);
  };
  return (
    <div className="page-sections">
      <div className="page-tabs" role="tablist" aria-label={name}>
        {labels.map((label, index) => (
          <button
            key={index}
            id={id + "-tab-" + index}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={id + "-panel-" + index}
            tabIndex={active === index ? 0 : -1}
            onClick={() => choose(index)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % labels.length
                  : event.key === "ArrowLeft"
                    ? (index + labels.length - 1) % labels.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? labels.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                choose(next);
                document.getElementById(id + "-tab-" + next)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div
          key={index}
          className="page-tabs-panel"
          id={id + "-panel-" + index}
          role="tabpanel"
          aria-labelledby={id + "-tab-" + index}
          hidden={active !== index}
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
export function DisclosureCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="form-card feature-disclosure">
      <summary>{title}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
