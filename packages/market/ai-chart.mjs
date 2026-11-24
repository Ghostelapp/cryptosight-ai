const valid = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
export function buildAIChartPlan(
  analysis,
  instrument,
  index = 0,
  context = null,
  demo = false,
) {
  if (
    !analysis ||
    demo ||
    analysis.symbol !== instrument.symbol ||
    analysis.timeframe !== instrument.timeframe
  )
    return null;
  if (
    context &&
    (context.venue !== instrument.venue || context.market !== instrument.market)
  )
    return null;
  const setups = analysis.setups || [],
    selected =
      Number.isInteger(index) && index >= 0 && index < setups.length
        ? index
        : 0;
  const setup = setups[selected];
  if (!setup) return null;
  const common = {
    index: selected,
    setup,
    direction: setup.direction,
    reasoning: setup.reasoning,
    timing: setup.timing,
    invalidation: setup.invalidation,
    timestamp: analysis.timestamp,
    summary: analysis.summary_short,
  };
  if (setup.direction === "NO_TRADE")
    return { ...common, noTrade: /** @type {const} */ (true), levels: [] };
  if (
    !["LONG", "SHORT"].includes(setup.direction) ||
    !valid(setup.entry?.price) ||
    !valid(setup.stop_loss) ||
    !valid(setup.trigger?.price) ||
    !Array.isArray(setup.entry?.zone) ||
    setup.entry.zone.length !== 2 ||
    !setup.entry.zone.every(valid) ||
    !setup.take_profits?.length ||
    !setup.take_profits.every((t) => valid(t.price))
  )
    return null;
  const merged =
    Math.abs(setup.entry.price - setup.trigger.price) <=
    setup.entry.price * 1e-10;
  const levels = [
    {
      id: "entry",
      kind: merged ? "entry_trigger" : "entry",
      price: setup.entry.price,
      color: "#36bed8",
      priority: 0,
    },
    {
      id: "stop",
      kind: "stop",
      price: setup.stop_loss,
      color: "#ed7684",
      priority: 1,
    },
    ...(!merged
      ? [
          {
            id: "trigger",
            kind: "trigger",
            price: setup.trigger.price,
            color: "#dfb65e",
            priority: 2,
          },
        ]
      : []),
    ...setup.take_profits.map((tp, n) => ({
      id: "tp" + (n + 1),
      kind: "target",
      price: tp.price,
      color: "#38c49a",
      priority: 3 + n,
      target: n + 1,
      allocation: tp.size_pct,
    })),
  ];
  return {
    ...common,
    noTrade: /** @type {const} */ (false),
    levels,
    zone: {
      low: Math.min(...setup.entry.zone),
      high: Math.max(...setup.entry.zone),
    },
    bounds: {
      low: Math.min(...levels.map((l) => l.price), ...setup.entry.zone),
      high: Math.max(...levels.map((l) => l.price), ...setup.entry.zone),
    },
  };
}

// Keep the true price anchor separate from a displaced label. Never relabel a price.
export function packAIChartLabels(levels, height, gap = 20, margin = 12) {
  const count = Math.max(0, Math.floor((height - 2 * margin) / gap));
  const rows = levels
    .filter((l) => Number.isFinite(l.y))
    .map((l) => ({ ...l }))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, count)
    .sort((a, b) => a.y - b.y);
  const max = height - margin;
  rows.forEach((l, n) => {
    l.labelY = Math.max(
      margin,
      Math.min(max, l.y),
      n ? rows[n - 1].labelY + gap : margin,
    );
  });
  if (rows.length && rows.at(-1).labelY > max) {
    rows.at(-1).labelY = max;
    for (let n = rows.length - 2; n >= 0; n--)
      rows[n].labelY = Math.min(rows[n].labelY, rows[n + 1].labelY - gap);
  }
  return rows.map((l) => ({
    ...l,
    outside: l.y < 0 || l.y > height,
    anchorY: Math.max(0, Math.min(height, l.y)),
  }));
}
