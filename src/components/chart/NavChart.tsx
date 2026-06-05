import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { GridComponent, TooltipComponent } from "echarts/components";
import { LineChart, ScatterChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { CHART_RANGES } from "../../constants/app";
import type { ChartData, Fund } from "../../types/fund";
import { filterChartData } from "../../utils/chart";
import { formatChartDate, formatMoney, formatNav, formatShares } from "../../utils/format";

echarts.use([GridComponent, TooltipComponent, LineChart, ScatterChart, CanvasRenderer]);

interface NavChartProps {
  fund: Fund;
  data: ChartData;
  loading: boolean;
  busy: boolean;
  onViewAllNav: () => void;
}

export function NavChart({ fund, data, loading, busy, onViewAllNav }: NavChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const [rangeKey, setRangeKey] = useState("6m");
  const filteredData = useMemo(() => filterChartData(data, rangeKey), [data, rangeKey]);

  useEffect(() => {
    if (!chartRef.current) return undefined;
    instanceRef.current = echarts.init(chartRef.current);

    const resize = () => instanceRef.current?.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;

    const navPoints = filteredData.nav.map((item) => [item.date, Number(item.nav)]);
    const confirmedTrades = filteredData.trades.filter((item) => item.status !== "pending" && item.nav);
    const buyPoints = confirmedTrades.filter((item) => item.type === "buy").map((item) => ({
      value: [item.date, Number(item.nav)],
      amount: item.amount,
      shares: item.shares,
      note: item.note,
      type: item.type,
    }));
    const sellPoints = confirmedTrades.filter((item) => item.type === "sell").map((item) => ({
      value: [item.date, Number(item.nav)],
      amount: item.amount,
      shares: item.shares,
      note: item.note,
      type: item.type,
    }));
    const averageCost = Number(data.position?.averageCost);
    const costLine =
      Number.isFinite(averageCost) && filteredData.nav.length > 0
        ? filteredData.nav.map((item) => [item.date, averageCost])
        : [];

    chart.setOption(
      {
        animationDuration: 360,
        color: ["#197b75", "#b4532a", "#2563eb", "#7c3aed"],
        grid: { left: 46, right: 22, top: 34, bottom: 34 },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross" },
          formatter(params: any[]) {
            const rows = params.map((param) => {
              if (param.seriesName === "买入点") {
                const point = param.data || {};
                const note = point.note ? `<br/>备注：${point.note}` : "";
                return `${param.marker}买入：${formatNav(param.value[1])}<br/>金额：${formatMoney(point.amount)}　份额：${formatShares(point.shares)}${note}`;
              }
              if (param.seriesName === "卖出点") {
                const point = param.data || {};
                const note = point.note ? `<br/>备注：${point.note}` : "";
                return `${param.marker}卖出：${formatNav(param.value[1])}<br/>金额：${formatMoney(point.amount)}　份额：${formatShares(point.shares)}${note}`;
              }
              if (param.seriesName === "成本价") {
                return `${param.marker}成本价：${formatNav(param.value[1])}`;
              }
              return `${param.marker}单位净值：${formatNav(param.value[1])}`;
            });
            return `${formatChartDate(params[0]?.axisValue)}<br/>${rows.join("<br/>")}`;
          },
        },
        xAxis: {
          type: "time",
          axisLine: { lineStyle: { color: "#a7b4bc" } },
          axisLabel: { color: "#65727e", formatter: formatChartDate },
        },
        yAxis: {
          type: "value",
          scale: true,
          axisLabel: { color: "#65727e", formatter: (value: number) => Number(value).toFixed(2) },
          splitLine: { lineStyle: { color: "#edf2f4" } },
        },
        series: [
          {
            name: "单位净值",
            type: "line",
            data: navPoints,
            showSymbol: false,
            smooth: false,
            lineStyle: { width: 2 },
            areaStyle: { opacity: 0.08 },
          },
          {
            name: "买入点",
            type: "scatter",
            data: buyPoints,
            symbolSize: 12,
            itemStyle: { borderColor: "#fff", borderWidth: 2 },
            z: 5,
          },
          {
            name: "卖出点",
            type: "scatter",
            data: sellPoints,
            symbol: "diamond",
            symbolSize: 12,
            itemStyle: { borderColor: "#fff", borderWidth: 2 },
            z: 5,
          },
          {
            name: "成本价",
            type: "line",
            data: costLine,
            showSymbol: false,
            smooth: false,
            lineStyle: { width: 2, type: "dashed", color: "#7c3aed" },
            z: 4,
          },
        ],
      },
      true,
    );
    chart.resize();
  }, [data.position?.averageCost, filteredData]);

  const totalNavCount = data.nav?.length || 0;
  const navCount = filteredData.nav.length;
  const confirmedTrades = filteredData.trades.filter((item) => item.status !== "pending");
  const buyCount = confirmedTrades.filter((item) => item.type === "buy").length;
  const sellCount = confirmedTrades.filter((item) => item.type === "sell").length;
  const pendingCount = filteredData.trades.filter((item) => item.status === "pending").length;
  const hasAverageCost = Number.isFinite(Number(data.position?.averageCost));
  const summary = loading
    ? "正在加载图表..."
    : navCount === 0
      ? "暂无净值数据"
      : `${filteredData.range.label}：${navCount} 条净值记录，买入 ${buyCount} 次，卖出 ${sellCount} 次${pendingCount ? `，待确认 ${pendingCount} 次` : ""}${hasAverageCost ? `，成本价 ${formatNav(data.position?.averageCost)}` : ""}${navCount === totalNavCount ? "" : ` / 共 ${totalNavCount} 条`}`;

  return (
    <section className="chart-block">
      <div className="table-title">
        <div>
          <div className="title-with-actions">
            <h3>净值走势</h3>
            <button className="text-action" type="button" disabled={busy} onClick={onViewAllNav}>
              查看更多历史
            </button>
          </div>
          <span>{summary}</span>
        </div>
        <div className="range-switcher" aria-label="净值走势时间范围">
          {CHART_RANGES.map((range) => (
            <button
              key={range.key}
              className={range.key === rangeKey ? "active" : ""}
              type="button"
              aria-pressed={range.key === rangeKey}
              onClick={() => setRangeKey(range.key)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-frame">
        {loading && (
          <div className="chart-loading" aria-live="polite">
            <div className="spinner small" aria-hidden="true"></div>
            <strong>加载图表中...</strong>
          </div>
        )}
        {!loading && navCount === 0 && <div className="chart-empty">暂无可展示的净值走势</div>}
        <div className="chart-canvas" ref={chartRef} aria-label={`${fund.name} 净值走势图`} />
      </div>
    </section>
  );
}
