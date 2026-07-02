import type { Fund } from "../../types/fund";
import { formatNav, formatPercent, formatUnits, formatMoney } from "../../utils/format";

interface SummaryCardsProps {
  fund: Fund;
}

export function SummaryCards({ fund }: SummaryCardsProps) {
  const isStock = fund.assetType === "stock";
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
  const dividendIncome = Number(position.dividendIncome);
  const latestPrice = status.latestPrice ?? status.latestNav;
  const lastBuyPrice = status.lastBuyPrice ?? status.lastBuyNav;
  const triggerPrice = status.triggerPrice ?? status.triggerNav;
  const holdingValue = Number.isFinite(totalShares) && Number.isFinite(Number(latestPrice)) ? totalShares * Number(latestPrice) : NaN;
  const holdingProfit = Number.isFinite(holdingValue) && Number.isFinite(totalAmount)
    ? holdingValue - totalAmount
    : NaN;
  const holdingProfitRate = Number.isFinite(holdingProfit) && Number.isFinite(totalAmount) && totalAmount > 0
    ? (holdingProfit / totalAmount) * 100
    : NaN;
  const totalProfit = Number.isFinite(holdingValue) && Number.isFinite(totalAmount) && Number.isFinite(realizedProfit)
    ? (holdingValue - totalAmount) + realizedProfit
    : NaN;
  const profitRateBase = Number.isFinite(totalAmount) && Number.isFinite(realizedCost) ? totalAmount + realizedCost : NaN;
  const totalProfitRate = Number.isFinite(totalProfit) && Number.isFinite(profitRateBase) && profitRateBase > 0 ? (totalProfit / profitRateBase) * 100 : NaN;
  const holdingDays = getHoldingDays(trades, totalShares);
  const hasBuy = Number.isFinite(Number(lastBuyPrice));
  const hasNav = Number.isFinite(Number(latestPrice));
  const hasAverageCost = Number.isFinite(Number(displayAverageCost));
  const currentMove = getCurrentMoveChip(lastBuyPrice, latestPrice);
  const holdingProfitTone = getTrendTone(holdingProfit);
  const holdingProfitRateTone = getTrendTone(holdingProfitRate);
  const profitTone = getTrendTone(totalProfit);
  const profitRateTone = getTrendTone(totalProfitRate);
  const requiredDropTone = hasBuy && hasNav ? "down" : null;

  let requiredDrop = isStock ? "不适用" : "待填写";
  let triggerStatus = isStock ? "股票模式" : hasBuy ? "缺昨日净值" : "缺买入记录";
  let triggerTone: "muted" | "primary" | "danger" = "muted";

  if (!isStock && hasBuy && hasNav && status.state === "triggered") {
    requiredDrop = "0.00%";
    triggerStatus = "已触发";
    triggerTone = "primary";
  } else if (!isStock && hasBuy && hasNav) {
    requiredDrop = formatPercent(status.requiredDropPercent);
    triggerStatus = "等待触发";
    triggerTone = "danger";
  }

  return (
    <section className="summary-stack" aria-label="持仓概览">
      <div className="summary-band summary-band-holding">
        <div className="summary-band-header">
          <p className="summary-band-eyebrow">当前持有</p>
          <h3>持仓表现</h3>
        </div>
        <div className="summary-band-grid summary-band-grid-primary">
          <article className="metric-card metric-card-hero">
            <span>当前持有市值</span>
            <strong>{Number.isFinite(holdingValue) ? formatMoney(holdingValue) : "待计算"}</strong>
          </article>
          <article className={`metric-card metric-card-hero ${holdingProfitTone === "up" ? "metric-card-positive" : holdingProfitTone === "down" ? "metric-card-negative" : ""}`}>
            <span>持有收益</span>
            <strong>{Number.isFinite(holdingProfit) ? formatMoney(holdingProfit) : "待计算"}</strong>
          </article>
          <article className={`metric-card metric-card-hero ${holdingProfitRateTone === "up" ? "metric-card-positive" : holdingProfitRateTone === "down" ? "metric-card-negative" : ""}`}>
            <span>持有收益率</span>
            <strong>{Number.isFinite(holdingProfitRate) ? formatPercent(holdingProfitRate) : "待计算"}</strong>
          </article>
        </div>
        <div className="summary-band-grid summary-band-grid-secondary">
          <article className="metric-card metric-card-group metric-card-compact">
            <div className="metric-card-pair">
              <span>持有成本</span>
              <strong>{Number.isFinite(totalAmount) ? formatMoney(totalAmount) : "待填写"}</strong>
            </div>
            <div className="metric-card-pair metric-card-pair-subtle">
              <span>{isStock ? "持有股数" : "持有份额"}</span>
              <strong>{Number.isFinite(totalShares) ? formatUnits(totalShares, fund.assetType) : "待填写"}</strong>
            </div>
            <div className="metric-card-pair metric-card-pair-subtle">
              <span>持有天数</span>
              <strong>{Number.isFinite(holdingDays) ? `${holdingDays} 天` : "待填写"}</strong>
            </div>
          </article>
          <article className="metric-card metric-card-group metric-card-compact">
            <div className="metric-card-pair">
              <span>{displayAverageCostLabel}</span>
              <strong>{hasAverageCost ? formatNav(displayAverageCost) : "待买入"}</strong>
            </div>
            <div className="metric-card-pair metric-card-pair-subtle">
              <span>{isStock ? "最新价格" : "最新净值"}</span>
              <strong>{hasNav ? formatNav(latestPrice) : "待填写"}</strong>
            </div>
          </article>
        </div>
      </div>

      <div className="summary-band summary-band-strategy">
        <div className="summary-band-header">
          <p className="summary-band-eyebrow">4% 定投法</p>
          <h3>触发判断</h3>
        </div>
        <div className="summary-strategy-grid">
          <article className="metric-card metric-card-compact trigger-card">
            <span>当前判断</span>
            <div className="trigger-tags">
              <span className={`status-chip ${triggerTone}`}>{triggerStatus}</span>
              {currentMove && <CurrentMoveChip move={currentMove} />}
            </div>
          </article>
          <article className={`metric-card metric-card-compact ${requiredDropTone === "down" ? "metric-card-negative" : ""}`}>
            <span>{isStock ? "策略提示" : "今日需达到跌幅"}</span>
            <strong>{requiredDrop}</strong>
          </article>
          <article className="metric-card metric-card-compact">
            <span>{isStock ? "最新价格" : "下一触发净值"}</span>
            <strong>{hasNav ? formatNav(isStock ? latestPrice : triggerPrice) : "待填写"}</strong>
          </article>
          <article className="metric-card metric-card-compact">
            <span>{isStock ? "最近成交价" : "上次买入净值"}</span>
            <strong>{hasBuy ? formatNav(lastBuyPrice) : "待填写"}</strong>
          </article>
        </div>
      </div>

      <div className="summary-band summary-band-total">
        <div className="summary-band-header">
          <p className="summary-band-eyebrow">累计</p>
          <h3>总体收益</h3>
        </div>
        <div className="summary-band-grid summary-band-grid-secondary">
          <article className={`metric-card metric-card-group metric-card-compact ${profitTone === "up" ? "metric-card-positive" : profitTone === "down" ? "metric-card-negative" : ""}`}>
            <div className="metric-card-pair">
              <span>累计收益</span>
              <strong>{Number.isFinite(totalProfit) ? formatMoney(totalProfit) : "待计算"}</strong>
            </div>
            <div className="metric-card-pair metric-card-pair-subtle">
              <span>累计收益率</span>
              <strong>{Number.isFinite(totalProfitRate) ? formatPercent(totalProfitRate) : "待计算"}</strong>
            </div>
          </article>
          <article className="metric-card metric-card-group metric-card-compact">
            <div className="metric-card-pair">
              <span>已实现收益</span>
              <strong>{Number.isFinite(realizedProfit) ? formatMoney(realizedProfit) : "待计算"}</strong>
            </div>
            <div className="metric-card-pair metric-card-pair-subtle">
              <span>分红收益</span>
              <strong>{Number.isFinite(dividendIncome) ? formatMoney(dividendIncome) : "0.00"}</strong>
            </div>
          </article>
        </div>
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
