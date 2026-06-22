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
  tradePrice: string;
  tradeShares: string;
  tradeFee: string;
  tradeNote: string;
  onTypeChange: (type: TradeType) => void;
  onDateChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onSharesChange: (value: string) => void;
  onFeeChange: (value: string) => void;
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
  tradePrice,
  tradeShares,
  tradeFee,
  tradeNote,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onPriceChange,
  onSharesChange,
  onFeeChange,
  onNoteChange,
  onSubmit,
  onEditTrade,
  onDeleteTrade,
}: TradeSectionProps) {
  return (
    <section className="buy-grid">
      <TradeForm
        busy={busy}
        isStock={fund.assetType === "stock"}
        tradeType={tradeType}
        tradeDate={tradeDate}
        tradeAmount={tradeAmount}
        tradePrice={tradePrice}
        tradeShares={tradeShares}
        tradeFee={tradeFee}
        tradeNote={tradeNote}
        onTypeChange={onTypeChange}
        onDateChange={onDateChange}
        onAmountChange={onAmountChange}
        onPriceChange={onPriceChange}
        onSharesChange={onSharesChange}
        onFeeChange={onFeeChange}
        onNoteChange={onNoteChange}
        onSubmit={onSubmit}
      />
      <TradeHistory fund={fund} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
    </section>
  );
}
