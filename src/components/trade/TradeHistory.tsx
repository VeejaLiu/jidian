import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../DataTable";
import { TradeActionMenu } from "./TradeActionMenu";
import type { Fund, TradeRecord } from "../../types/fund";
import { formatMoney, formatNav, formatUnits, tradeTypeLabel } from "../../utils/format";

interface TradeHistoryProps {
  fund: Fund;
  onEditTrade: (record: TradeRecord) => void;
  onDeleteTrade: (record: TradeRecord) => void;
}

export function TradeHistory({ fund, onEditTrade, onDeleteTrade }: TradeHistoryProps) {
  const isStock = fund.assetType === "stock";
  const [page, setPage] = useState(1);
  const trades = fund.trades || fund.buys || [];
  const dividends = fund.dividends || [];
  const latestTrade = trades[0];
  const buyDropMap = useMemo(() => buildBuyDropMap(trades), [trades]);
  const sellReturnRateMap = useMemo(() => buildSellReturnRateMap(trades), [trades]);
  const columns = useMemo(() => {
    const baseColumns = [
      {
        key: "type",
        render: (record: TradeRecord) => (
          <span className={`trade-badge ${record.type === "sell" ? "sell" : "buy"}`}>
            {tradeTypeLabel(record.type)}
          </span>
        ),
      },
      {
        key: "status",
        render: (record: TradeRecord) => (
          <span className={`trade-status ${record.status === "pending" ? "pending" : "confirmed"}`}>
            {record.status === "pending" ? "待确认" : "已确认"}
          </span>
        ),
      },
      { key: "date", render: (record: TradeRecord) => record.date },
      { key: "nav", render: (record: TradeRecord) => (record.status === "pending" ? (isStock ? "待同步" : "待公布") : formatNav(record.nav)) },
      {
        key: "buyDrop",
        render: (record: TradeRecord) => <BuyDropCell record={record} drop={buyDropMap.get(record.id)} />,
      },
      {
        key: "sellReturnRate",
        render: (record: TradeRecord) => <SellReturnRateCell record={record} rate={sellReturnRateMap.get(record.id)} />,
      },
      { key: "amount", render: (record: TradeRecord) => formatMoney(record.amount) },
    ];

    if (isStock) {
      baseColumns.push({
        key: "fee",
        render: (record: TradeRecord) => formatMoney(record.fee ?? 0),
      });
    }

    baseColumns.push(
      { key: "shares", render: (record: TradeRecord) => (record.status === "pending" ? "待确认" : formatUnits(record.shares, fund.assetType)) },
      { key: "note", render: (record: TradeRecord) => record.note || "" },
    );

    return baseColumns;
  }, [buyDropMap, fund.assetType, isStock, sellReturnRateMap]);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(trades.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageTrades = trades.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [fund.id]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="table-block">
      <div className="table-title">
        <div>
          <h3>交易记录</h3>
          <span>{latestTrade ? `最近：${latestTrade.date} / ${tradeTypeLabel(latestTrade.type)} / ${formatNav(latestTrade.nav)}` : ""}</span>
        </div>
      </div>
      {dividends.length > 0 && (
        <div className="dividend-list" aria-label="分红记录">
          {dividends.slice(0, 3).map((dividend) => (
            <span key={dividend.id}>
              {dividend.date} / {dividend.type === "cash" ? "现金分红" : "红利再投"} / {formatMoney(dividend.amount)}
            </span>
          ))}
        </div>
      )}
      <div className="table-wrap buy-history-wrap">
        <table>
          <thead>
            <tr>
              <th>类型</th>
              <th>状态</th>
              <th>日期</th>
              <th>{isStock ? "成交价" : "净值"}</th>
              <th>{isStock ? "较上次买入价" : "较上次买入"}</th>
              <th>{isStock ? "卖出回报率" : "卖出收益率"}</th>
              <th>{isStock ? "成交金额" : "金额"}</th>
              {isStock && <th>税费</th>}
              <th>{isStock ? "股数" : "份额"}</th>
              <th>备注</th>
              <th></th>
            </tr>
          </thead>
          <DataTable
            records={pageTrades}
            columns={columns}
            renderActions={(record) => (
              <TradeActionMenu record={record} onEdit={onEditTrade} onDelete={onDeleteTrade} />
            )}
            minRows={pageSize}
            emptyText="暂无交易记录"
          />
        </table>
      </div>
      <div className="pagination compact-pagination">
        {trades.length > pageSize && (
          <>
            <button className="secondary-button" type="button" disabled={safePage <= 1} onClick={() => setPage((current) => current - 1)}>
              上一页
            </button>
            <span>
              第 {safePage} / {totalPages} 页，共 {trades.length} 条
            </span>
            <button className="secondary-button" type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => current + 1)}>
              下一页
            </button>
          </>
        )}
      </div>
    </div>
  );
}

type BuyDropInfo =
  | { kind: "first" }
  | { kind: "drop"; percent: number };

type SellReturnRateInfo =
  | { kind: "pending" }
  | { kind: "empty" }
  | { kind: "value"; percent: number };

function buildBuyDropMap(trades: TradeRecord[]) {
  const confirmedBuys = trades
    .filter((trade) => trade.type === "buy" && trade.status !== "pending" && Number(trade.nav) > 0)
    .sort((left, right) => {
      if (left.date === right.date) return left.id - right.id;
      return left.date.localeCompare(right.date);
    });
  const map = new Map<number, BuyDropInfo>();

  confirmedBuys.forEach((trade, index) => {
    if (index === 0) {
      map.set(trade.id, { kind: "first" });
      return;
    }

    const previousNav = Number(confirmedBuys[index - 1].nav);
    const currentNav = Number(trade.nav);
    if (!Number.isFinite(previousNav) || previousNav <= 0 || !Number.isFinite(currentNav)) return;
    map.set(trade.id, { kind: "drop", percent: ((previousNav - currentNav) / previousNav) * 100 });
  });

  return map;
}

function buildSellReturnRateMap(trades: TradeRecord[]) {
  const timeline = [...trades].sort((left, right) => {
    if (left.date === right.date) {
      if (left.type === right.type) return left.id - right.id;
      return left.type === "buy" ? -1 : 1;
    }
    return left.date.localeCompare(right.date);
  });

  let totalAmount = 0;
  let totalShares = 0;
  const map = new Map<number, SellReturnRateInfo>();

  timeline.forEach((trade) => {
    if (trade.type === "sell" && trade.status === "pending") {
      map.set(trade.id, { kind: "pending" });
      return;
    }

    if (trade.status === "pending") return;

    const amount = Number(trade.amount);
    const shares = Number(trade.shares);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(shares) || shares <= 0) {
      if (trade.type === "sell") map.set(trade.id, { kind: "empty" });
      return;
    }

    if (trade.type === "buy") {
      totalAmount += amount;
      totalShares += shares;
      return;
    }

    const averageCost = totalShares > 0 ? totalAmount / totalShares : 0;
    const soldShares = Math.min(shares, totalShares);
    if (!Number.isFinite(averageCost) || averageCost <= 0 || soldShares <= 0) {
      map.set(trade.id, { kind: "empty" });
      return;
    }

    const realizedCost = averageCost * soldShares;
    const realizedProfit = amount - realizedCost;
    map.set(trade.id, {
      kind: "value",
      percent: realizedCost > 0 ? (realizedProfit / realizedCost) * 100 : 0,
    });

    totalAmount -= realizedCost;
    totalShares -= soldShares;

    if (Math.abs(totalAmount) < 0.000001) totalAmount = 0;
    if (Math.abs(totalShares) < 0.000001) totalShares = 0;
  });

  return map;
}

function BuyDropCell({ record, drop }: { record: TradeRecord; drop?: BuyDropInfo }) {
  if (record.type !== "buy") return <span className="muted-cell">--</span>;
  if (record.status === "pending") return <span className="muted-cell">待确认</span>;
  if (!drop) return <span className="muted-cell">--</span>;
  if (drop.kind === "first") return <span className="buy-drop-tag first">首次买入</span>;

  const isDrop = drop.percent >= 0;
  return (
    <span className={`buy-drop-tag ${isDrop ? "drop" : "rise"}`}>
      {isDrop ? "下跌" : "上涨"} {Math.abs(drop.percent).toFixed(2)}%
    </span>
  );
}

function SellReturnRateCell({ record, rate }: { record: TradeRecord; rate?: SellReturnRateInfo }) {
  if (record.type !== "sell") return <span className="muted-cell">--</span>;
  if (!rate || rate.kind === "empty") return <span className="muted-cell">--</span>;
  if (rate.kind === "pending") return <span className="muted-cell">待确认</span>;

  const tone = Math.abs(rate.percent) < 0.005 ? "flat" : rate.percent >= 0 ? "up" : "down";
  const label = `${rate.percent >= 0 ? "+" : ""}${rate.percent.toFixed(2)}%`;

  return <span className={`daily-change-tag ${tone}`}>{label}</span>;
}
