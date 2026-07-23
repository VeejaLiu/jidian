import { useEffect, useState } from "react";
import type { AssetType, DividendType, TradeDraft, TradeRecord, TradeType } from "../types/fund";
import { todayISO } from "../utils/date";

const emptyEditDraft: TradeDraft = {
  type: "buy",
  date: todayISO(),
  amount: "",
  price: "",
  shares: "",
  fee: "",
  note: "",
};

function calculateStockAmount(type: TradeType, priceValue: string, sharesValue: string, feeValue: string) {
  const price = Number(priceValue);
  const shares = Number(sharesValue);
  const fee = Number(feeValue || 0);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(fee) || fee < 0) {
    return "";
  }

  const gross = price * shares;
  const amount = type === "buy" ? gross + fee : gross - fee;
  return amount > 0 ? amount.toFixed(2) : "";
}

export function useTradeForm(assetType?: AssetType | null) {
  const [tradeType, setTradeType] = useState<TradeType>("buy");
  const [tradeDate, setTradeDate] = useState(todayISO());
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeShares, setTradeShares] = useState("");
  const [tradeFee, setTradeFee] = useState("");
  const [tradeNote, setTradeNote] = useState("");
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [editTradeDraft, setEditTradeDraft] = useState<TradeDraft>(emptyEditDraft);
  const [dividendType, setDividendType] = useState<DividendType>("cash");
  const [dividendDate, setDividendDate] = useState(todayISO());
  const [dividendAmount, setDividendAmount] = useState("");
  const [dividendNav, setDividendNav] = useState("");
  const [dividendShares, setDividendShares] = useState("");
  const [dividendNote, setDividendNote] = useState("");
  const isStock = assetType === "stock";

  useEffect(() => {
    if (!isStock && ["stock_bonus", "capital_increase", "dividend_tax"].includes(dividendType)) {
      setDividendType("cash");
    }
  }, [dividendType, isStock]);

  useEffect(() => {
    if (!isStock) return;
    setTradeAmount(calculateStockAmount(tradeType, tradePrice, tradeShares, tradeFee));
  }, [isStock, tradeFee, tradePrice, tradeShares, tradeType]);

  useEffect(() => {
    if (!editingTrade || !isStock) return;
    const nextAmount = calculateStockAmount(
      editTradeDraft.type,
      editTradeDraft.price,
      editTradeDraft.shares,
      editTradeDraft.fee,
    );
    setEditTradeDraft((current) => (current.amount === nextAmount ? current : { ...current, amount: nextAmount }));
  }, [editTradeDraft.fee, editTradeDraft.price, editTradeDraft.shares, editTradeDraft.type, editingTrade, isStock]);

  function clearTradeForm() {
    setTradeAmount("");
    setTradePrice("");
    setTradeShares("");
    setTradeFee("");
    setTradeNote("");
  }

  function openEditTrade(record: TradeRecord) {
    setEditingTrade(record);
    setEditTradeDraft({
      type: record.type,
      date: record.date,
      amount: String(record.amount ?? ""),
      price: String(record.nav ?? ""),
      shares: String(record.shares ?? ""),
      fee: String(record.fee ?? ""),
      note: record.note || "",
    });
  }

  function closeEditTrade() {
    setEditingTrade(null);
  }

  function clearDividendForm() {
    setDividendAmount("");
    setDividendNav("");
    setDividendShares("");
    setDividendNote("");
  }

  return {
    tradeType,
    setTradeType,
    tradeDate,
    setTradeDate,
    tradeAmount,
    setTradeAmount,
    tradePrice,
    setTradePrice,
    tradeShares,
    setTradeShares,
    tradeFee,
    setTradeFee,
    tradeNote,
    setTradeNote,
    editingTrade,
    editTradeDraft,
    setEditTradeDraft,
    clearTradeForm,
    openEditTrade,
    closeEditTrade,
    dividendType,
    setDividendType,
    dividendDate,
    setDividendDate,
    dividendAmount,
    setDividendAmount,
    dividendNav,
    setDividendNav,
    dividendShares,
    setDividendShares,
    dividendNote,
    setDividendNote,
    clearDividendForm,
  };
}
