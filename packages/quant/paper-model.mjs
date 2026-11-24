// Isolated paper collateral exhaustion including the fixed exit fee.
// This is deliberately separate from a venue's maintenance-margin model.
export function paperLiquidationPrice(entry, direction, leverage = 1) {
  if (
    !Number.isFinite(entry) ||
    entry <= 0 ||
    !Number.isInteger(leverage) ||
    leverage <= 1 ||
    leverage > 20 ||
    !["LONG", "SHORT"].includes(direction)
  )
    return null;
  const sign = direction === "LONG" ? 1 : -1;
  return (entry * (1 - sign / leverage)) / (1 - sign * 0.001);
}
