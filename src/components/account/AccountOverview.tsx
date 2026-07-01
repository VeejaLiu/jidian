import type { AccountSummary, UserAccount } from "../../types/fund";
import { formatMoney, formatPercent } from "../../utils/format";

interface AccountOverviewProps {
  account: UserAccount | null;
  summary: AccountSummary | null;
  loading: boolean;
}

export function AccountOverview({ account, summary, loading }: AccountOverviewProps) {
  if (!account) return null;

  const totals = summary?.totals;
  const cards = [
    { label: "当前市值", value: formatMoney(totals?.marketValue) },
    { label: "持仓成本", value: formatMoney(totals?.totalCost) },
    { label: "累计收益", value: formatMoney(totals?.totalProfit), tone: Number(totals?.totalProfit) >= 0 ? "up" : "down" },
    { label: "累计收益率", value: totals?.totalProfitRate === null ? "--" : formatPercent(totals?.totalProfitRate), tone: Number(totals?.totalProfitRate) >= 0 ? "up" : "down" },
    { label: "年化收益率", value: totals?.xirr == null ? "--" : formatPercent(totals.xirr), tone: Number(totals?.xirr) >= 0 ? "up" : "down" },
    { label: "基金市值", value: formatMoney(totals?.fundMarketValue) },
    { label: "股票市值", value: formatMoney(totals?.stockMarketValue) },
  ];

  return (
    <section className="account-overview" aria-label="账户总览">
      <div className="account-overview-header">
        <div>
          <p className="eyebrow">账户总览</p>
          <h2>{account.name}</h2>
        </div>
        <span>{loading ? "统计中..." : `${totals?.assetCount ?? 0} 个资产`}</span>
      </div>

      <div className="account-overview-grid">
        {cards.map((card) => (
          <article className={card.tone ? `metric-card ${card.tone === "up" ? "metric-card-positive" : "metric-card-negative"}` : "metric-card"} key={card.label}>
            <span>{card.label}</span>
            <strong>{loading ? "--" : card.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
