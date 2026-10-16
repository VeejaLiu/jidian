import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DataTable } from "../DataTable";
import { EditDividendModal, type DividendDraft } from "./EditDividendModal";
import { TradeActionMenu } from "./TradeActionMenu";
import type { DividendRecord, Fund, TradeRecord } from "../../types/fund";
import { formatMoney, formatNav, formatUnits, tradeTypeLabel } from "../../utils/format";

type TimelineRecord = (TradeRecord & { recordKind: "trade" }) | (DividendRecord & { recordKind: "dividend"; status?: never; fee?: never });

interface TradeHistoryProps {
  fund: Fund;
  busy: boolean;
  onAddRecord: () => void;
  onEditTrade: (record: TradeRecord) => void;
  onDeleteTrade: (record: TradeRecord) => void;
  onUpdateDividend: (record: DividendRecord, draft: DividendDraft) => void;
}

export function TradeHistory({ fund, busy, onAddRecord, onEditTrade, onDeleteTrade, onUpdateDividend }: TradeHistoryProps) {
  const isStock = fund.assetType === "stock";
  const [page, setPage] = useState(1);
  const [editingDividend, setEditingDividend] = useState<DividendRecord | null>(null);
  const [dividendDraft, setDividendDraft] = useState<DividendDraft | null>(null);
  const trades = fund.trades || fund.buys || [];
  const dividends = fund.dividends || [];
  const records = useMemo<TimelineRecord[]>(() => [
    ...trades.map((record) => ({ ...record, recordKind: "trade" as const })),
    ...dividends.map((record) => ({ ...record, recordKind: "dividend" as const })),
  ].sort((left, right) => left.date === right.date ? right.id - left.id : right.date.localeCompare(left.date)), [dividends, trades]);
  const latestRecord = records[0];
  const buyDropMap = useMemo(() => buildBuyDropMap(trades), [trades]);
  const sellReturnRateMap = useMemo(() => buildSellReturnRateMap(trades, dividends), [dividends, trades]);
  const columns = useMemo<Array<{ key: string; render: (record: TimelineRecord) => ReactNode }>>(() => {
    const baseColumns = [
      {
        key: "type",
        render: (record: TimelineRecord) => (
          <span className="trade-type-cell">
            <span className={`trade-badge ${record.recordKind === "trade" ? (record.type === "sell" ? "sell" : "buy") : "dividend"}`}>
              {record.recordKind === "trade" ? tradeTypeLabel(record.type) : dividendTypeLabel(record.type)}
            </span>
            {record.recordKind === "trade" && record.positionStage && (
              <span className={`position-stage-tag ${record.positionStage}`}>
                {record.positionStage === "opening" ? "建仓" : "清仓"}
              </span>
            )}
          </span>
        ),
      },
      {
        key: "status",
        render: (record: TimelineRecord) => (
          <span className={`trade-status ${record.recordKind === "trade" && record.status === "pending" ? "pending" : "confirmed"}`}>
            {record.recordKind === "trade" && record.status === "pending" ? "待确认" : "已确认"}
          </span>
        ),
      },
      { key: "date", render: (record: TimelineRecord) => record.date },
      { key: "nav", render: (record: TimelineRecord) => record.recordKind === "dividend" ? "--" : (record.status === "pending" ? (isStock ? "待同步" : "待公布") : formatNav(record.nav)) },
      {
        key: "buyDrop",
        render: (record: TimelineRecord) => record.recordKind === "trade" ? <BuyDropCell record={record} drop={buyDropMap.get(record.id)} /> : <span className="muted-cell">--</span>,
      },
      {
        key: "sellReturnRate",
        render: (record: TimelineRecord) => record.recordKind === "trade" ? <SellReturnRateCell record={record} rate={sellReturnRateMap.get(record.id)} /> : <span className="muted-cell">--</span>,
      },
      {
        key: "amount",
        render: (record: TimelineRecord) => record.recordKind === "dividend" && (record.type === "stock_bonus" || record.type === "capital_increase")
          ? "--"
          : (record.recordKind === "trade" && record.status === "pending" && !Number.isFinite(Number(record.amount)) ? "待确认" : formatMoney(record.amount)),
      },
    ];

    baseColumns.push({
      key: "fee",
      render: (record: TimelineRecord) => record.recordKind === "trade" ? formatMoney(record.fee ?? 0) : "--",
    });

    baseColumns.push(
      { key: "shares", render: (record: TimelineRecord) => record.recordKind === "trade" && record.status === "pending" ? "待确认" : formatUnits(record.shares, fund.assetType) },
      { key: "note", render: (record: TimelineRecord) => record.note || "" },
    );

    return baseColumns;
  }, [buyDropMap, fund.assetType, isStock, sellReturnRateMap]);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRecords = records.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [fund.id]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openDividendEditor = (record: DividendRecord) => {
    setEditingDividend(record);
    setDividendDraft({
      type: record.type,
      date: record.date,
      amount: String(record.amount ?? ""),
      nav: String(record.nav ?? ""),
      shares: String(record.shares ?? ""),
      note: record.note || "",
    });
  };

  const submitDividendEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingDividend || !dividendDraft) return;
    onUpdateDividend(editingDividend, dividendDraft);
    setEditingDividend(null);
    setDividendDraft(null);
  };

  return (
    <div className="table-block">
      <div className="table-title">
        <div>
          <h3>交易记录</h3>
          <span>{latestRecord ? `最近：${latestRecord.date} / ${latestRecord.recordKind === "trade" ? tradeTypeLabel(latestRecord.type) : dividendTypeLabel(latestRecord.type)}` : ""}</span>
        </div>
        <button className="secondary-button add-record-button" type="button" disabled={busy} onClick={onAddRecord}>添加记录</button>
      </div>
      <div className="table-wrap buy-history-wrap" role="region" aria-label="交易记录表格，可横向滚动" tabIndex={0}>
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
              <th>{isStock ? "税费" : "手续费"}</th>
              <th>{isStock ? "股数" : "份额"}</th>
              <th>备注</th>
              <th></th>
            </tr>
          </thead>
          <DataTable
            records={pageRecords}
            columns={columns}
            renderActions={(record) => (
              <TradeActionMenu
                record={record}
                onEdit={(current) => current.recordKind === "trade" ? onEditTrade(current) : openDividendEditor(current)}
                onDelete={record.recordKind === "trade" ? (current) => onDeleteTrade(current as TradeRecord) : undefined}
              />
            )}
            minRows={pageSize}
            emptyText="暂无交易记录"
          />
        </table>
      </div>
      <p className="table-scroll-hint">左右滑动查看完整记录，操作按钮始终保留在右侧。</p>
      <div className="pagination compact-pagination">
        {records.length > pageSize && (
          <>
            <button className="secondary-button" type="button" disabled={safePage <= 1} onClick={() => setPage((current) => current - 1)}>
              上一页
            </button>
            <span>
              第 {safePage} / {totalPages} 页，共 {records.length} 条
            </span>
            <button className="secondary-button" type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => current + 1)}>
              下一页
            </button>
          </>
        )}
      </div>
      <EditDividendModal
        fund={fund}
        record={editingDividend}
        draft={dividendDraft}
        busy={busy}
        onDraftChange={setDividendDraft}
        onClose={() => {
          setEditingDividend(null);
          setDividendDraft(null);
        }}
        onSubmit={submitDividendEdit}
      />
    </div>
  );
}

function dividendTypeLabel(type: string) {
  if (type === "reinvest") return "红利再投";
  if (type === "stock_bonus") return "送股";
  if (type === "capital_increase") return "转增股本";
  if (type === "dividend_tax") return "股息红利个人所得税";
  return "现金分红";
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
    if (index === 0 || trade.positionStage === "opening") {
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

function buildSellReturnRateMap(trades: TradeRecord[], dividends: DividendRecord[]) {
  const timeline = [
    ...trades.map((trade) => ({ kind: "trade" as const, date: trade.date, id: trade.id, trade })),
    ...dividends.map((dividend) => ({ kind: "dividend" as const, date: dividend.date, id: dividend.id, dividend })),
  ].sort((left, right) => {
    if (left.date === right.date) {
      if (left.kind === right.kind) return left.id - right.id;
      return left.kind === "dividend" ? -1 : 1;
    }
    return left.date.localeCompare(right.date);
  });

  let totalAmount = 0;
  let totalShares = 0;
  const map = new Map<number, SellReturnRateInfo>();

  timeline.forEach((item) => {
    if (item.kind === "dividend") {
      const increasesShares = item.dividend.type === "stock_bonus"
        || item.dividend.type === "capital_increase"
        || item.dividend.type === "reinvest";
      const shares = Number(item.dividend.shares);
      if (increasesShares && Number.isFinite(shares) && shares > 0) totalShares += shares;
      return;
    }

    const { trade } = item;
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
