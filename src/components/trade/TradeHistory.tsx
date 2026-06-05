import { useEffect, useState } from "react";
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
