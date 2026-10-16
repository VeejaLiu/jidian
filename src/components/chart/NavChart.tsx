import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as echarts from "echarts/core";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CandlestickChart, LineChart, ScatterChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { CHART_RANGES } from "../../constants/app";
import type { ChartData, Fund, NavPoint } from "../../types/fund";
import { filterChartData } from "../../utils/chart";
import { formatChartDate, formatMoney, formatNav, formatUnits } from "../../utils/format";

echarts.use([GridComponent, TooltipComponent, CandlestickChart, LineChart, ScatterChart, CanvasRenderer]);

interface NavChartProps {
  fund: Fund;
  data: ChartData;
  loading: boolean;
  busy: boolean;
  onViewAllNav: () => void;
}

export function NavChart({ fund, data, loading, busy, onViewAllNav }: NavChartProps) {
  const isStock = fund.assetType === "stock";
  const chartRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const tooltipLayerRef = useRef<HTMLDivElement | null>(null);
  const [rangeKey, setRangeKey] = useState("6m");
  const filteredData = useMemo(() => filterChartData(data, rangeKey), [data, rangeKey]);
  const renderAsKLine = isStock && filteredData.nav.some(hasStockOhlcData);

  useEffect(() => {
    if (!chartRef.current) return undefined;
    instanceRef.current = echarts.init(chartRef.current);

    const resize = () => {
      instanceRef.current?.dispatchAction({ type: "hideTip" });
      instanceRef.current?.resize();
    };
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(chartRef.current);

    return () => {
      window.removeEventListener("resize", resize);
      observer.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;

    const useKLine = isStock && filteredData.nav.some(hasStockOhlcData);
    const dates = filteredData.nav.map((item) => item.date);
    const navPoints = filteredData.nav.map((item) => ({
      value: [item.date, Number(item.nav)],
      dailyChangePercent: item.dailyChangePercent,
    }));
    const kLinePoints = filteredData.nav.map((item) => {
      const close = getStockClose(item);
      const open = getStockPriceValue(item.openPrice, close);
      const low = getStockPriceValue(item.lowPrice, Math.min(open, close));
      const high = getStockPriceValue(item.highPrice, Math.max(open, close));
      return {
        value: [open, close, low, high],
        date: item.date,
        dailyChangePercent: item.dailyChangePercent,
      };
    });
    const confirmedTrades = filteredData.trades.filter((item) => item.status !== "pending" && item.nav);
    const buyPoints = confirmedTrades.filter((item) => item.type === "buy").map((item) => ({
      value: [item.date, Number(item.nav)],
      amount: item.amount,
      shares: item.shares,
      note: item.note,
      type: item.type,
      assetType: fund.assetType,
    }));
    const sellPoints = confirmedTrades.filter((item) => item.type === "sell").map((item) => ({
      value: [item.date, Number(item.nav)],
      amount: item.amount,
      shares: item.shares,
      note: item.note,
      type: item.type,
      assetType: fund.assetType,
    }));
    const averageCost = Number(data.position?.averageCost);
    const hasOpenPosition = Boolean(data.position?.hasOpenPosition);
    const costLine =
      hasOpenPosition && Number.isFinite(averageCost) && filteredData.nav.length > 0
        ? filteredData.nav.map((item) => [item.date, averageCost])
        : [];
    const chartBuyPoints = useKLine ? toCategoryTradePoints(buyPoints, dates) : buyPoints;
    const chartSellPoints = useKLine ? toCategoryTradePoints(sellPoints, dates) : sellPoints;
    const chartCostLine = useKLine ? costLine.map((item) => [dates.indexOf(String(item[0])), item[1]]).filter((item) => Number(item[0]) >= 0) : costLine;

    chart.setOption(
      {
        animationDuration: 360,
        color: [getCssVar("--up"), getCssVar("--down"), getCssVar("--primary"), getCssVar("--primary-dark")],
        grid: { left: 46, right: 22, top: 34, bottom: 34 },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross" },
          appendTo: () => tooltipLayerRef.current || document.body,
          confine: false,
          enterable: true,
          transitionDuration: 0,
          position: (point, _params, _dom, _rect, size) => {
            const bounds = chartRef.current?.getBoundingClientRect();
            if (!bounds) return point;
            return [
              Math.max(12 - bounds.left, Math.min(point[0] + 12, window.innerWidth - bounds.left - size.contentSize[0] - 12)),
              Math.max(12 - bounds.top, Math.min(point[1] + 12, window.innerHeight - bounds.top - size.contentSize[1] - 12)),
            ];
          },
          className: "chart-tooltip-shell",
          backgroundColor: "transparent",
          borderWidth: 0,
          padding: 0,
          extraCssText: "box-shadow:none;",
          formatter(params: any[]) {
            return renderChartTooltip(params);
          },
        },
        xAxis: {
          type: useKLine ? "category" : "time",
          data: useKLine ? dates : undefined,
          boundaryGap: useKLine,
          axisLine: { lineStyle: { color: "#a7b4bc" } },
          axisLabel: { color: "#65727e", formatter: formatChartDate, hideOverlap: true },
        },
        yAxis: {
          type: "value",
          scale: true,
          axisLabel: { color: "#65727e", formatter: (value: number) => Number(value).toFixed(2) },
          splitLine: { lineStyle: { color: "#edf2f4" } },
        },
        series: [
          useKLine
            ? {
                name: "K线",
                type: "candlestick",
                data: kLinePoints,
                itemStyle: {
                  color: getCssVar("--up"),
                  color0: getCssVar("--down"),
                  borderColor: getCssVar("--up"),
                  borderColor0: getCssVar("--down"),
                },
              }
            : {
                name: isStock ? "价格" : "单位净值",
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
            data: chartBuyPoints,
            symbolSize: 12,
            itemStyle: { color: getCssVar("--trade-buy"), borderColor: "#fff", borderWidth: 2 },
            z: 5,
          },
          {
            name: "卖出点",
            type: "scatter",
            data: chartSellPoints,
            symbol: "diamond",
            symbolSize: 12,
            itemStyle: { color: getCssVar("--trade-sell"), borderColor: "#fff", borderWidth: 2 },
            z: 5,
          },
          {
            name: "成本价",
            type: "line",
            data: chartCostLine,
            showSymbol: false,
            smooth: false,
            lineStyle: { width: 2, type: "dashed", color: getCssVar("--down-strong") },
            z: 4,
          },
        ],
      },
      true,
    );
    chart.resize();
  }, [data.position?.averageCost, filteredData, fund.assetType, isStock]);

  const totalNavCount = data.nav?.length || 0;
  const navCount = filteredData.nav.length;
  const confirmedTrades = filteredData.trades.filter((item) => item.status !== "pending");
  const buyCount = confirmedTrades.filter((item) => item.type === "buy").length;
  const sellCount = confirmedTrades.filter((item) => item.type === "sell").length;
  const pendingCount = filteredData.trades.filter((item) => item.status === "pending").length;
  const hasAverageCost = Number.isFinite(Number(data.position?.displayAverageCost));
  const showCostLine = Boolean(data.position?.hasOpenPosition) && Number.isFinite(Number(data.position?.averageCost));
  const displayAverageCostLabel = data.position?.displayAverageCostLabel || "成本价";
  const summary = loading
    ? "正在加载图表..."
    : navCount === 0
      ? `暂无${isStock ? "价格" : "净值"}数据`
      : `${filteredData.range.label}：${navCount} 条${isStock ? (renderAsKLine ? "K 线" : "价格") : "净值"}记录，买入 ${buyCount} 次，卖出 ${sellCount} 次${pendingCount ? `，待确认 ${pendingCount} 次` : ""}${hasAverageCost ? `，${displayAverageCostLabel} ${formatNav(data.position?.displayAverageCost)}` : ""}${navCount === totalNavCount ? "" : ` / 共 ${totalNavCount} 条`}`;

  return (
    <section className="chart-block">
      <div className="table-title">
        <div>
          <div className="title-with-actions">
            <h3>{isStock ? (renderAsKLine ? "K 线走势" : "价格走势") : "净值走势"}</h3>
            <button className="text-action" type="button" disabled={busy} onClick={onViewAllNav}>
              查看更多历史
            </button>
          </div>
          <span>{summary}</span>
        </div>
        <div className="range-switcher" aria-label={`${isStock ? "价格" : "净值"}走势时间范围`}>
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
        {!loading && navCount === 0 && <div className="chart-empty">暂无可展示的{isStock ? "价格" : "净值"}走势</div>}
        <div className="chart-canvas" ref={chartRef} aria-label={`${fund.name}${isStock ? (renderAsKLine ? "K 线" : "价格") : "净值"}走势图`} />
      </div>
      {createPortal(<div className="chart-tooltip-layer" ref={tooltipLayerRef} />, document.body)}
    </section>
  );
}

function renderChartTooltip(params: any[]) {
  const navParam = params.find((param) => param.seriesName === "单位净值" || param.seriesName === "价格");
  const kLineParam = params.find((param) => param.seriesName === "K线");
  const tradeParams = params.filter((param) => param.seriesName === "买入点" || param.seriesName === "卖出点");
  const costParam = params.find((param) => param.seriesName === "成本价");
  const date = formatChartDate(params[0]?.axisValue);

  return `
    <div class="chart-tooltip">
      <div class="chart-tooltip-header">
        <div>
          <span>价格日期</span>
          <strong>${escapeHtml(date)}</strong>
        </div>
        <span class="chart-tooltip-header-mark" aria-hidden="true"></span>
      </div>
      ${kLineParam ? renderKLineTooltipSection(kLineParam) : ""}
      ${navParam ? renderNavTooltipSection(navParam) : ""}
      ${costParam ? `<div class="chart-tooltip-divider"></div>${renderCostTooltipSection(costParam)}` : ""}
      ${tradeParams.length ? `<div class="chart-tooltip-divider"></div><div class="chart-tooltip-trades">${tradeParams.map(renderTradeTooltipSection).join("")}</div>` : ""}
    </div>
  `;
}

function renderKLineTooltipSection(param: any) {
  const values = getKLineValues(param);
  const [open, close, low, high] = values;
  const change = getDailyChange(param.data?.dailyChangePercent);
  return `
    <div class="chart-tooltip-section chart-tooltip-section-panel">
      <div class="chart-tooltip-section-title">
        <span class="chart-tooltip-dot primary"></span>
        <span>K 线表现</span>
      </div>
      ${renderMetricRow("开盘", formatNav(open), "muted")}
      ${renderMetricRow("收盘", formatNav(close), "cost")}
      ${renderMetricRow("最高", formatNav(high), "up")}
      ${renderMetricRow("最低", formatNav(low), "down")}
      <div class="chart-tooltip-row">
        <span>较前日</span>
        ${
          change
            ? `<strong class="${change.direction}">${escapeHtml(change.label)} ${escapeHtml(change.percent)}</strong>`
            : '<strong class="muted">--</strong>'
        }
      </div>
    </div>
  `;
}

function getKLineValues(param: any) {
  const dataValue = param.data?.value;
  if (Array.isArray(dataValue) && dataValue.length >= 4) return dataValue;

  const value = param.value;
  if (!Array.isArray(value)) return [];
  if (value.length >= 5 && typeof value[0] === "number") return value.slice(1, 5);
  return value.slice(0, 4);
}

function renderNavTooltipSection(param: any) {
  const point = param.data || {};
  const change = getDailyChange(point.dailyChangePercent);
  return `
    <div class="chart-tooltip-section chart-tooltip-section-panel">
      <div class="chart-tooltip-section-title">
        <span class="chart-tooltip-dot primary"></span>
        <span>价格表现</span>
      </div>
      <div class="chart-tooltip-kpi">
        <span>价格</span>
        <strong>${escapeHtml(formatNav(param.value?.[1]))}</strong>
      </div>
      <div class="chart-tooltip-row">
        <span>较前日</span>
        ${
          change
            ? `<strong class="${change.direction}">${escapeHtml(change.label)} ${escapeHtml(change.percent)}</strong>`
            : '<strong class="muted">--</strong>'
        }
      </div>
    </div>
  `;
}

function getStockClose(point: NavPoint) {
  return getStockPriceValue(point.closePrice, Number(point.nav));
}

function hasStockOhlcData(point: NavPoint) {
  return [point.openPrice, point.closePrice, point.highPrice, point.lowPrice].every((value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
  });
}

function getStockPriceValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toCategoryTradePoints(points: any[], dates: string[]) {
  return points
    .map((point) => {
      const date = String(point.value?.[0] || "");
      const index = dates.indexOf(date);
      if (index < 0) return null;
      return {
        ...point,
        value: [index, point.value?.[1]],
      };
    })
    .filter(Boolean);
}

function renderCostTooltipSection(param: any) {
  return `
    <div class="chart-tooltip-section">
      <div class="chart-tooltip-section-title">
        <span class="chart-tooltip-line-sample"></span>
        <span>持仓参考</span>
      </div>
      ${renderMetricRow("成本价", formatNav(param.value?.[1]), "cost")}
    </div>
  `;
}

function renderTradeTooltipSection(param: any) {
  const point = param.data || {};
  const isBuy = param.seriesName === "买入点";
  const label = isBuy ? "买入" : "卖出";
  const tone = isBuy ? "buy" : "sell";
  const note = point.note ? `<div class="chart-tooltip-note"><span>备注</span><p>${escapeHtml(point.note)}</p></div>` : "";
  const unitLabel = point.assetType === "stock" ? "股数" : "份额";

  return `
    <div class="chart-tooltip-section chart-tooltip-trade-card ${tone}">
      <div class="chart-tooltip-trade-title">
        <span class="chart-tooltip-dot ${tone}"></span>
        <strong>${label}记录</strong>
      </div>
      ${renderMetricRow("净值", formatNav(param.value?.[1]), tone)}
      ${renderMetricRow("金额", Number.isFinite(Number(point.amount)) ? formatMoney(point.amount) : "待确认", "muted")}
      ${renderMetricRow(unitLabel, formatUnits(point.shares, point.assetType), "muted")}
      ${note}
    </div>
  `;
}

function renderMetricRow(label: string, value: string, tone: string) {
  return `
    <div class="chart-tooltip-row">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function getDailyChange(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (Math.abs(number) < 0.005) return { direction: "flat", label: "持平", percent: "0.00%" };
  return {
    direction: number > 0 ? "up" : "down",
    label: number > 0 ? "上涨" : "下跌",
    percent: `${Math.abs(number).toFixed(2)}%`,
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCssVar(name: string) {
  if (typeof window === "undefined") return name;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || name;
}
