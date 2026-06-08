import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../DataTable";
import { TradeActionMenu } from "./TradeActionMenu";
import type { Fund, TradeRecord } from "../../types/fund";
import { formatMoney, formatNav, formatShares, tradeTypeLabel } from "../../utils/format";

interface TradeHistoryProps {
  fund: Fund;
  onEditTrade: (record: TradeRecord) => void;
  onDeleteTrade: (record: TradeRecord) => void;
}

export function TradeHistory({ fund, onEditTrade, onDeleteTrade }: TradeHistoryProps) {
  const [page, setPage] = useState(1);
  const trades = fund.trades || fund.buys || [];
  const latestTrade = trades[0];
  const buyDropMap = useMemo(() => buildBuyDropMap(trades), [trades]);
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
      <div className="table-wrap buy-history-wrap">
        <table>
          <thead>
            <tr>
              <th>类型</th>
              <th>状态</th>
              <th>日期</th>
              <th>净值</th>
              <th>较上次买入</th>
              <th>金额</th>
              <th>份额</th>
              <th>备注</th>
              <th></th>
            </tr>
          </thead>
          <DataTable
            records={pageTrades}
            columns={[
              {
                key: "type",
                render: (record) => (
                  <span className={`trade-badge ${record.type === "sell" ? "sell" : "buy"}`}>
                    {tradeTypeLabel(record.type)}
                  </span>
                ),
              },
              {
                key: "status",
                render: (record) => (
                  <span className={`trade-status ${record.status === "pending" ? "pending" : "confirmed"}`}>
                    {record.status === "pending" ? "待确认" : "已确认"}
                  </span>
                ),
              },
              { key: "date", render: (record) => record.date },
              { key: "nav", render: (record) => (record.status === "pending" ? "待公布" : formatNav(record.nav)) },
              {
                key: "buyDrop",
                render: (record) => <BuyDropCell record={record} drop={buyDropMap.get(record.id)} />,
              },
              { key: "amount", render: (record) => formatMoney(record.amount) },
              { key: "shares", render: (record) => (record.status === "pending" ? "待确认" : formatShares(record.shares)) },
              { key: "note", render: (record) => record.note || "" },
            ]}
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
