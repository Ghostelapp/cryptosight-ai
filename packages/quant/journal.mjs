export function tradePnl(row) {
  return (
    (row.side === "SHORT"
      ? Number(row.entry) - Number(row.exit)
      : Number(row.exit) - Number(row.entry)) *
      Number(row.quantity) -
    Number(row.fees || 0)
  );
}

// These are the supplied entries, ordered by recording date, not account equity.
export function journalStats(entries) {
  const ordered = [...entries].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
      String(a.id).localeCompare(String(b.id)),
  );
  let total = 0,
    peak = 0,
    maxDrawdown = 0,
    grossProfit = 0,
    grossLoss = 0,
    wins = 0;
  const curve = [{ index: 0, pnl: 0 }];
  ordered.forEach((row, index) => {
    const pnl = tradePnl(row);
    total += pnl;
    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
    }
    if (pnl < 0) grossLoss -= pnl;
    peak = Math.max(peak, total);
    maxDrawdown = Math.max(maxDrawdown, peak - total);
    curve.push({ index: index + 1, pnl: total });
  });
  return {
    count: ordered.length,
    total,
    wins,
    winRate: ordered.length ? (wins / ordered.length) * 100 : null,
    average: ordered.length ? total / ordered.length : null,
    profitFactor: grossLoss ? grossProfit / grossLoss : null,
    noLosses: grossProfit > 0 && grossLoss === 0,
    maxDrawdown: ordered.length ? maxDrawdown : null,
    curve,
  };
}

function csvCell(value) {
  let text = String(value ?? "");
  // Neutralize spreadsheet formulas in free text, preserving numeric negatives.
  if (typeof value === "string" && /^[\s\uFEFF]*[=+\-@]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function journalCsv(entries) {
  const headers = [
    "recorded_at",
    "symbol",
    "side",
    "entry",
    "exit",
    "quantity",
    "fees",
    "net_pnl",
    "notes",
  ];
  return (
    "\uFEFF" +
    [
      headers,
      ...entries.map((row) => [
        row.created_at,
        row.symbol,
        row.side,
        Number(row.entry),
        Number(row.exit),
        Number(row.quantity),
        Number(row.fees || 0),
        tradePnl(row),
        row.notes,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}
