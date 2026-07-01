import type { FormEvent } from "react";
import type { DividendType, Fund, TradeRecord, TradeType } from "../../types/fund";
import { DividendForm } from "./DividendForm";
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
}: TradeSectionProps) {
  return (
    <section className="buy-grid">
      <div className="trade-form-stack">
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
        <DividendForm
          busy={busy}
          type={dividendType}
          date={dividendDate}
          amount={dividendAmount}
          nav={dividendNav}
          shares={dividendShares}
          note={dividendNote}
          onTypeChange={onDividendTypeChange}
          onDateChange={onDividendDateChange}
          onAmountChange={onDividendAmountChange}
          onNavChange={onDividendNavChange}
          onSharesChange={onDividendSharesChange}
          onNoteChange={onDividendNoteChange}
          onSubmit={onDividendSubmit}
        />
      </div>
      <TradeHistory fund={fund} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
    </section>
  );
}
