import type { FormEvent } from "react";
import type { Fund, TradeRecord, TradeType } from "../../types/fund";
import { TradeForm } from "./TradeForm";
import { TradeHistory } from "./TradeHistory";

interface TradeSectionProps {
  fund: Fund;
  busy: boolean;
  tradeType: TradeType;
  tradeDate: string;
  tradeAmount: string;
  tradeNote: string;
  onTypeChange: (type: TradeType) => void;
  onDateChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEditTrade: (record: TradeRecord) => void;
  onDeleteTrade: (record: TradeRecord) => void;
}

export function TradeSection({
  fund,
  busy,
  tradeType,
  tradeDate,
  tradeAmount,
  tradeNote,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onNoteChange,
  onSubmit,
  onEditTrade,
  onDeleteTrade,
}: TradeSectionProps) {
  return (
    <section className="buy-grid">
      <TradeForm
        busy={busy}
        tradeType={tradeType}
        tradeDate={tradeDate}
        tradeAmount={tradeAmount}
        tradeNote={tradeNote}
        onTypeChange={onTypeChange}
        onDateChange={onDateChange}
        onAmountChange={onAmountChange}
        onNoteChange={onNoteChange}
        onSubmit={onSubmit}
      />
      <TradeHistory fund={fund} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
    </section>
  );
}
