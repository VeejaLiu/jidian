import { useState, type FormEvent } from "react";
import type { ChartData, DividendRecord, DividendType, Fund, TradeRecord, TradeType } from "../../types/fund";
import { AddRecordModal } from "./AddRecordModal";
import type { DividendDraft } from "./EditDividendModal";
import { TradeHistory } from "./TradeHistory";

interface TradeSectionProps {
  fund: Fund;
  chartData: ChartData;
  busy: boolean;
  tradeType: TradeType;
  tradeDate: string;
  tradeAmount: string;
  tradePrice: string;
  tradeShares: string;
  tradeFee: string;
  tradeNote: string;
  dividendType: DividendType;
  dividendDate: string;
  dividendAmount: string;
  dividendNav: string;
  dividendShares: string;
  dividendNote: string;
  onTypeChange: (type: TradeType) => void;
  onDateChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onSharesChange: (value: string) => void;
  onFeeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDividendTypeChange: (type: DividendType) => void;
  onDividendDateChange: (value: string) => void;
  onDividendAmountChange: (value: string) => void;
  onDividendNavChange: (value: string) => void;
  onDividendSharesChange: (value: string) => void;
  onDividendNoteChange: (value: string) => void;
  onDividendSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEditTrade: (record: TradeRecord) => void;
  onDeleteTrade: (record: TradeRecord) => void;
  onUpdateDividend: (record: DividendRecord, draft: DividendDraft) => void;
}

export function TradeSection({
  fund,
  chartData,
  busy,
  tradeType,
  tradeDate,
  tradeAmount,
  tradePrice,
  tradeShares,
  tradeFee,
  tradeNote,
  dividendType,
  dividendDate,
  dividendAmount,
  dividendNav,
  dividendShares,
  dividendNote,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onPriceChange,
  onSharesChange,
  onFeeChange,
  onNoteChange,
  onSubmit,
  onDividendTypeChange,
  onDividendDateChange,
  onDividendAmountChange,
  onDividendNavChange,
  onDividendSharesChange,
  onDividendNoteChange,
  onDividendSubmit,
  onEditTrade,
  onDeleteTrade,
  onUpdateDividend,
}: TradeSectionProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
    <section className="buy-grid">
      <TradeHistory fund={fund} busy={busy} onAddRecord={() => setAddModalOpen(true)} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} onUpdateDividend={onUpdateDividend} />
      {addModalOpen && <AddRecordModal
        fund={fund}
        navPoints={chartData.nav}
        busy={busy}
        tradeType={tradeType}
        tradeDate={tradeDate}
        tradeAmount={tradeAmount}
        tradePrice={tradePrice}
        tradeShares={tradeShares}
        tradeFee={tradeFee}
        tradeNote={tradeNote}
        dividendType={dividendType}
        dividendDate={dividendDate}
        dividendAmount={dividendAmount}
        dividendNav={dividendNav}
        dividendShares={dividendShares}
        dividendNote={dividendNote}
        onTypeChange={onTypeChange}
        onDateChange={onDateChange}
        onAmountChange={onAmountChange}
        onPriceChange={onPriceChange}
        onSharesChange={onSharesChange}
        onFeeChange={onFeeChange}
        onNoteChange={onNoteChange}
        onSubmit={onSubmit}
        onDividendTypeChange={onDividendTypeChange}
        onDividendDateChange={onDividendDateChange}
        onDividendAmountChange={onDividendAmountChange}
        onDividendNavChange={onDividendNavChange}
        onDividendSharesChange={onDividendSharesChange}
        onDividendNoteChange={onDividendNoteChange}
        onDividendSubmit={onDividendSubmit}
        onClose={() => setAddModalOpen(false)}
      />}
    </section>
  );
}
