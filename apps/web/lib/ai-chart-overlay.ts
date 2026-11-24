import { packAIChartLabels } from "../../../packages/market/ai-chart.mjs";
export function registerAIChart(k: any) {
  k.registerIndicator({
    name: "CS_AI_BOUNDS",
    shortName: "",
    // Feed invisible values into range calculation. KLineCharts 9.8.12's
    // dynamic maxValue override mistakenly calls setMinValue.
    figures: [
      { key: "low", type: "line" },
      { key: "high", type: "line" },
    ],
    calc: (data: any[], indicator: any) =>
      data.map(() => ({
        low: indicator.calcParams[0],
        high: indicator.calcParams[1],
      })),
    draw: () => true,
    createTooltipDataSource: () => ({
      name: "",
      calcParamsText: "",
      icons: [],
      values: [],
    }),
  });
  k.registerOverlay({
    name: "csAIPlan",
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, bounding, yAxis, coordinates }: any) => {
      if (!yAxis || !overlay.extendData) return [];
      const { plan, labels, dark, context = [] } = overlay.extendData,
        w = bounding.width,
        h = bounding.height;
      const narrow = w < 420,
        font = narrow ? 10 : 11;
      const xStart = Math.max(
          w * 0.35,
          Math.min(w * 0.78, coordinates[0]?.x || w * 0.65),
        ),
        xEnd = w - 8;
      const figures: any[] = [];
      if (plan.noTrade)
        figures.push({
          type: "text",
          ignoreEvent: true,
          attrs: {
            x: 10,
            y: 38,
            text: labels.status,
            align: "left",
            baseline: "middle",
          },
          styles: {
            color: dark ? "#dfb65e" : "#6b4d12",
            size: narrow ? 10 : 12,
            family: "Arial, sans-serif",
            backgroundColor: dark ? "#101b28" : "#ffffff",
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 3,
            paddingBottom: 3,
          },
        });
      const line = (y: number, color: string, size = 1, dashed = true) => ({
        type: "line",
        ignoreEvent: true,
        attrs: {
          coordinates: [
            { x: 8, y },
            { x: w - 8, y },
          ],
        },
        styles: {
          color,
          size,
          style: dashed ? "dashed" : "solid",
          dashedValue: [5, 4],
        },
      });
      const band = (a: number, b: number, color: string) => {
        const top = Math.max(0, Math.min(a, b)),
          bottom = Math.min(h, Math.max(a, b));
        if (bottom > top)
          figures.push({
            type: "rect",
            ignoreEvent: true,
            attrs: {
              x: xStart,
              y: top,
              width: Math.max(1, xEnd - xStart),
              height: bottom - top,
            },
            styles: { style: "fill", color },
          });
      };
      if (
        !plan.noTrade &&
        Number.isFinite(coordinates[0]?.x) &&
        coordinates[0].x >= 0 &&
        coordinates[0].x < w
      ) {
        const yEntry = yAxis.convertToPixel(plan.setup.entry.price);
        band(
          yEntry,
          yAxis.convertToPixel(plan.setup.stop_loss),
          "rgba(237,118,132,0.10)",
        );
        band(
          yEntry,
          yAxis.convertToPixel(plan.setup.take_profits.at(-1).price),
          "rgba(56,196,154,0.08)",
        );
        band(
          yAxis.convertToPixel(plan.zone.low),
          yAxis.convertToPixel(plan.zone.high),
          "rgba(54,190,216,0.17)",
        );
      }
      const all = [...plan.levels, ...context].map((level: any) => ({
        ...level,
        y: yAxis.convertToPixel(level.price),
      }));
      for (const l of all)
        if (Number.isFinite(l.y) && l.y >= 0 && l.y <= h)
          figures.push(
            line(
              l.y,
              l.color,
              ["entry", "entry_trigger", "stop"].includes(l.kind) ? 1.6 : 1,
              l.kind !== "entry" &&
                l.kind !== "entry_trigger" &&
                l.kind !== "stop",
            ),
          );
      for (const l of packAIChartLabels(
        all,
        h,
        narrow ? 19 : 22,
        plan.noTrade ? 56 : 14,
      )) {
        const x = w - 8,
          labelLeft = Math.max(12, w - (narrow ? 145 : 190));
        const text = (l.outside ? (l.y < 0 ? "↑ " : "↓ ") : "") + labels[l.id];
        figures.push({
          type: "line",
          ignoreEvent: true,
          attrs: {
            coordinates: [
              { x: labelLeft - 24, y: l.anchorY },
              { x: labelLeft - 7, y: l.labelY },
              { x: labelLeft, y: l.labelY },
            ],
          },
          styles: { color: l.color, size: 1 },
        });
        figures.push({
          type: "text",
          ignoreEvent: true,
          attrs: { x, y: l.labelY, text, align: "right", baseline: "middle" },
          styles: {
            color: dark ? l.color : "#182a3b",
            size: font,
            family: "Arial, sans-serif",
            backgroundColor: dark ? "#101b28" : "#ffffff",
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 3,
            paddingBottom: 3,
            borderColor: l.color,
            borderSize: 1,
            borderRadius: 3,
          },
        });
      }
      return figures;
    },
  });
}
