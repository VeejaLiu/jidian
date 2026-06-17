import type { Fund } from "../../types/fund";
import { formatNav, formatPercent, formatShares, formatMoney } from "../../utils/format";

interface SummaryCardsProps {
  fund: Fund;
}

export function SummaryCards({ fund }: SummaryCardsProps) {
  const status = fund.status || {};
  const position = fund.position || {};
  const trades = fund.trades || fund.buys || [];
  const averageCost = position.averageCost;
  const displayAverageCost = position.displayAverageCost;
  const displayAverageCostLabel = position.displayAverageCostLabel || "成本价";
  const totalAmount = Number(position.totalAmount);
  const totalShares = Number(position.totalShares);
  const realizedCost = Number(position.realizedCost);
  const realizedProfit = Number(position.realizedProfit);
  const holdingValue = Number.isFinite(totalShares) && Number.isFinite(Number(status.latestNav)) ? totalShares * Number(status.latestNav) : NaN;
  const totalProfit = Number.isFinite(holdingValue) && Number.isFinite(totalAmount) && Number.isFinite(realizedProfit)
    ? (holdingValue - totalAmount) + realizedProfit
    : NaN;
  const profitRateBase = Number.isFinite(totalAmount) && Number.isFinite(realizedCost) ? totalAmount + realizedCost : NaN;
  const totalProfitRate = Number.isFinite(totalProfit) && Number.isFinite(profitRateBase) && profitRateBase > 0 ? (totalProfit / profitRateBase) * 100 : NaN;
  const holdingDays = getHoldingDays(trades, totalShares);
  const hasBuy = Number.isFinite(Number(status.lastBuyNav));
  const hasNav = Number.isFinite(Number(status.latestNav));
  const hasAverageCost = Number.isFinite(Number(displayAverageCost));
  const currentMove = getCurrentMoveChip(status.lastBuyNav, status.latestNav);
  const profitTone = getTrendTone(totalProfit);
  const profitRateTone = getTrendTone(totalProfitRate);
  const requiredDropTone = hasBuy && hasNav ? "down" : null;

  let requiredDrop = "待填写";
  let triggerStatus = hasBuy ? "缺昨日净值" : "缺买入记录";
  let triggerTone: "muted" | "primary" | "danger" = "muted";

  if (hasBuy && hasNav && status.state === "triggered") {
    requiredDrop = "0.00%";
    triggerStatus = "已触发";
    triggerTone = "primary";
  } else if (hasBuy && hasNav) {
    requiredDrop = formatPercent(status.requiredDropPercent);
    triggerStatus = "等待触发";
    triggerTone = "danger";
  }

  return (
    <section className="summary-stack" aria-label="持仓概览">
      <div className="summary-hero">
        <article className="metric-card metric-card-hero">
          <span>持有金额</span>
          <strong>{Number.isFinite(totalAmount) ? formatMoney(totalAmount) : "待填写"}</strong>
        </article>
        <article className="metric-card metric-card-hero">
          <span>持有份额</span>
          <strong>{Number.isFinite(totalShares) ? formatShares(totalShares) : "待填写"}</strong>
        </article>
        <article className={`metric-card metric-card-hero ${profitTone === "up" ? "metric-card-positive" : profitTone === "down" ? "metric-card-negative" : ""}`}>
          <span>累计收益</span>
          <strong>{Number.isFinite(totalProfit) ? formatMoney(totalProfit) : "待计算"}</strong>
        </article>
        <article className={`metric-card metric-card-hero ${profitRateTone === "up" ? "metric-card-positive" : profitRateTone === "down" ? "metric-card-negative" : ""}`}>
          <span>累计收益率</span>
          <strong>{Number.isFinite(totalProfitRate) ? formatPercent(totalProfitRate) : "待计算"}</strong>
        </article>
        <article className="metric-card metric-card-hero">
          <span>持有天数</span>
          <strong>{Number.isFinite(holdingDays) ? `${holdingDays} 天` : "待填写"}</strong>
        </article>
      </div>

      <div className="summary-secondary">
        <article className="metric-card metric-card-compact">
          <span>上次买入净值</span>
          <strong>{hasBuy ? formatNav(status.lastBuyNav) : "待填写"}</strong>
        </article>
        <article className="metric-card metric-card-compact">
          <span>下一触发净值</span>
          <strong>{hasBuy ? formatNav(status.triggerNav) : "待填写"}</strong>
        </article>
        <article className={`metric-card metric-card-compact ${requiredDropTone === "down" ? "metric-card-negative" : ""}`}>
          <span>今日需达到跌幅</span>
          <strong>{requiredDrop}</strong>
        </article>
        <article className="metric-card metric-card-compact cost">
          <span>{displayAverageCostLabel}</span>
          <strong>{hasAverageCost ? formatNav(displayAverageCost) : "待买入"}</strong>
        </article>
        <article className="metric-card metric-card-compact trigger-card">
          <span>判断</span>
          <div className="trigger-tags">
            <span className={`status-chip ${triggerTone}`}>{triggerStatus}</span>
            {currentMove && <CurrentMoveChip move={currentMove} />}
            {hasBuy && hasNav && <span className="status-chip neutral">触发价 {formatNav(status.triggerNav)}</span>}
          </div>
        </article>
      </div>
    </section>
  );
}

function getHoldingDays(trades: Array<{ date?: string | null; status?: string | null }>, totalShares: number) {
  const confirmedDates = trades
    .filter((trade) => trade.status !== "pending" && trade.date)
    .map((trade) => trade.date as string)
    .sort((left, right) => left.localeCompare(right));

  if (!confirmedDates.length || !Number.isFinite(totalShares)) return NaN;

  const start = new Date(`${confirmedDates[0]}T00:00:00`);
  const endDate = totalShares > 0 ? new Date() : new Date(`${confirmedDates[confirmedDates.length - 1]}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endDate.getTime())) return NaN;

  const diff = endDate.getTime() - start.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

function getCurrentMoveChip(lastBuyNav: unknown, latestNav: unknown) {
  const lastBuy = Number(lastBuyNav);
  const latest = Number(latestNav);
  if (!Number.isFinite(lastBuy) || lastBuy <= 0 || !Number.isFinite(latest)) return null;

  const percent = ((latest - lastBuy) / lastBuy) * 100;
  if (Math.abs(percent) < 0.005) {
    return { tone: "flat" as const, percent: "0.00%" };
  }

  return {
    tone: percent >= 0 ? "up" as const : "down" as const,
    percent: `${Math.abs(percent).toFixed(2)}%`,
  };
}

function getTrendTone(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) < 0.0001) return null;
  return number >= 0 ? ("up" as const) : ("down" as const);
}

function CurrentMoveChip({ move }: { move: NonNullable<ReturnType<typeof getCurrentMoveChip>> }) {
  return (
    <span className={`status-chip neutral move-chip ${move.tone}`}>
      <span className="move-chip-label">较上次</span>
      <TrendIcon tone={move.tone} />
      <strong>{move.percent}</strong>
    </span>
  );
}

function TrendIcon({ tone }: { tone: "up" | "down" | "flat" }) {
  return (
    <span className="move-icon" aria-hidden="true">
      <svg viewBox="0 0 20 20" focusable="false">
        {tone === "flat" ? (
          <>
            <path d="M5.5 10h9" />
            <path d="M10 5.5v9" />
          </>
        ) : tone === "up" ? (
          <>
            <path d="M5.5 12.5l4.5-5 4.5 5" />
            <path d="M10 7v6" />
          </>
        ) : (
          <>
            <path d="M5.5 7.5l4.5 5 4.5-5" />
            <path d="M10 7v6" />
          </>
        )}
      </svg>
    </span>
  );
}
