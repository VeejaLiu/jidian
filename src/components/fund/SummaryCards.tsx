import type { Fund } from "../../types/fund";
import { formatNav, formatPercent } from "../../utils/format";

interface SummaryCardsProps {
  fund: Fund;
}

export function SummaryCards({ fund }: SummaryCardsProps) {
  const status = fund.status || {};
  const averageCost = fund.position?.averageCost;
  const hasBuy = Number.isFinite(Number(status.lastBuyNav));
  const hasNav = Number.isFinite(Number(status.latestNav));
  const hasAverageCost = Number.isFinite(Number(averageCost));
  const currentMoveText = getCurrentMoveText(status.lastBuyNav, status.latestNav);

  let requiredDrop = "待填写";
  let triggerStatus = hasBuy ? "缺昨日净值" : "缺买入记录";

  if (hasBuy && hasNav && status.state === "triggered") {
    requiredDrop = "0.00%";
    triggerStatus = `已触发，${currentMoveText}，跌到 ${formatNav(status.triggerNav)} 买入`;
  } else if (hasBuy && hasNav) {
    requiredDrop = formatPercent(status.requiredDropPercent);
    triggerStatus = `${currentMoveText}，跌到 ${formatNav(status.triggerNav)} 买入`;
  }

  return (
    <section className="summary-grid" aria-label="今日触发数据">
      <article className="metric-card">
        <span>上次买入净值</span>
        <strong>{hasBuy ? formatNav(status.lastBuyNav) : "待填写"}</strong>
      </article>
      <article className="metric-card">
        <span>下一触发净值</span>
        <strong>{hasBuy ? formatNav(status.triggerNav) : "待填写"}</strong>
      </article>
      <article className="metric-card accent">
        <span>今日需达到跌幅</span>
        <strong>{requiredDrop}</strong>
      </article>
      <article className="metric-card cost">
        <span>当前成本价</span>
        <strong>{hasAverageCost ? formatNav(averageCost) : "待买入"}</strong>
      </article>
      <article className="metric-card">
        <span>判断</span>
        <strong>{triggerStatus}</strong>
      </article>
    </section>
  );
}

function getCurrentMoveText(lastBuyNav: unknown, latestNav: unknown) {
  const lastBuy = Number(lastBuyNav);
  const latest = Number(latestNav);
  if (!Number.isFinite(lastBuy) || lastBuy <= 0 || !Number.isFinite(latest)) return "";

  const percent = ((lastBuy - latest) / lastBuy) * 100;
  if (Math.abs(percent) < 0.005) return "较上次买入基本持平";
  return `较上次买入${percent >= 0 ? "已下跌" : "已上涨"} ${Math.abs(percent).toFixed(2)}%`;
}
