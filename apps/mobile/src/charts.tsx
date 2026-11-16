import React, { memo, useMemo, useState } from "react";
import { Text, View } from "react-native";
import Svg, {
  G,
  Line,
  Rect,
  Polyline,
  Text as SvgText,
} from "react-native-svg";
import { colors, s, useMobile } from "./ui";
import { number } from "./i18n";
import type { Candle } from "./types";

export const CandleChart = memo(function CandleChart({
  candles,
}: {
  candles: Candle[];
}) {
  const { locale, t } = useMobile();
  const [selected, setSelected] = useState<number | null>(null);
  const chart = useMemo(() => {
    const values: (number | null)[] = [];
    for (let index = 0; index < candles.length; index++) {
      values.push(
        index < 19
          ? null
          : index === 19
            ? candles.slice(0, 20).reduce((sum, c) => sum + c.close, 0) / 20
            : values[index - 1]! +
              ((candles[index].close - values[index - 1]!) * 2) / 21,
      );
    }
    const visible = candles.slice(-60),
      emaValues = values.slice(-60);
    const high = Math.max(
      ...visible.map((c) => c.high),
      ...emaValues.filter((v): v is number => v != null),
    );
    const low = Math.min(
      ...visible.map((c) => c.low),
      ...emaValues.filter((v): v is number => v != null),
    );
    const padding = (high - low) * 0.07 || high * 0.01 || 1;
    const max = high + padding,
      min = low - padding;
    const y = (value: number) => 12 + ((max - value) / (max - min)) * 220;
    const x = (index: number) => 8 + ((index + 0.5) * 300) / visible.length;
    return { visible, emaValues, y, x, high, low };
  }, [candles]);
  if (!candles.length) return null;
  const chosen =
    chart.visible.find((bar) => bar.timestamp === selected) ||
    chart.visible.at(-1)!;
  const color = chosen.close >= chosen.open ? colors.green : colors.red;
  return (
    <View>
      <View
        accessible
        accessibilityLabel={`${t("mobileSelectedCandle")} ${number(locale, chosen.close, 6)}`}
      >
        <Svg width="100%" height={255} viewBox="0 0 365 255">
          {[0, 0.5, 1].map((f) => (
            <Line
              key={f}
              x1={0}
              x2={310}
              y1={12 + f * 220}
              y2={12 + f * 220}
              stroke={colors.line}
              strokeDasharray="3 5"
            />
          ))}
          {chart.visible.map((bar, index) => {
            const fill = bar.close >= bar.open ? colors.green : colors.red;
            return (
              <G key={bar.timestamp} onPress={() => setSelected(bar.timestamp)}>
                <Rect
                  x={chart.x(index) - 3}
                  y={0}
                  width={6}
                  height={245}
                  fill={bar.timestamp === selected ? "#20364a" : "transparent"}
                />
                <Line
                  x1={chart.x(index)}
                  x2={chart.x(index)}
                  y1={chart.y(bar.high)}
                  y2={chart.y(bar.low)}
                  stroke={fill}
                />
                <Rect
                  x={chart.x(index) - 1.7}
                  y={chart.y(Math.max(bar.open, bar.close))}
                  width={3.4}
                  height={Math.max(
                    1,
                    Math.abs(chart.y(bar.open) - chart.y(bar.close)),
                  )}
                  fill={fill}
                />
              </G>
            );
          })}
          <Polyline
            points={chart.emaValues
              .flatMap((value, index) =>
                value == null ? [] : [`${chart.x(index)},${chart.y(value)}`],
              )
              .join(" ")}
            stroke={colors.cyan}
            strokeWidth={1.3}
            fill="none"
          />
          <Line
            x1={0}
            x2={310}
            y1={chart.y(chosen.close)}
            y2={chart.y(chosen.close)}
            stroke={color}
            strokeDasharray="4 4"
          />
          <SvgText x={315} y={24} fill={colors.muted} fontSize={9}>
            {number(locale, chart.high, 2)}
          </SvgText>
          <SvgText x={315} y={226} fill={colors.muted} fontSize={9}>
            {number(locale, chart.low, 2)}
          </SvgText>
        </Svg>
      </View>
      <Text style={s.label}>
        EMA 20 · {new Date(chosen.timestamp).toLocaleString(locale)}
      </Text>
      <Text style={s.label}>
        O {number(locale, chosen.open, 4)} · H {number(locale, chosen.high, 4)}{" "}
        · L {number(locale, chosen.low, 4)} · C{" "}
        {number(locale, chosen.close, 4)}
      </Text>
    </View>
  );
});

export function PnlChart({ points }: { points: { pnl: number }[] }) {
  const high = Math.max(0, ...points.map((p) => p.pnl)),
    low = Math.min(0, ...points.map((p) => p.pnl));
  const y = (value: number) => 120 - ((value - low) / (high - low || 1)) * 100;
  return (
    <Svg
      width="100%"
      height={140}
      viewBox="0 0 340 140"
      accessibilityLabel="PnL"
    >
      <Line
        x1={4}
        x2={336}
        y1={y(0)}
        y2={y(0)}
        stroke={colors.line}
        strokeDasharray="4 4"
      />
      <Polyline
        points={points
          .map(
            (p, i) =>
              `${4 + (i / Math.max(1, points.length - 1)) * 332},${y(p.pnl)}`,
          )
          .join(" ")}
        stroke={(points.at(-1)?.pnl || 0) >= 0 ? colors.green : colors.red}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}
