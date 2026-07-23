import { useEffect, useState, type FormEvent } from "react";
import type { DividendType, Fund, NavPoint, TradeType } from "../../types/fund";
import { DividendForm } from "./DividendForm";
import { TradeForm } from "./TradeForm";

type EntryMode = "trade" | "corporateAction";

interface AddRecordModalProps {
  fund: Fund;
  navPoints: NavPoint[];
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
  onClose: () => void;
}

export function AddRecordModal(props: AddRecordModalProps) {
  const [mode, setMode] = useState<EntryMode>("trade");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !props.busy) props.onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [props.busy, props.onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="addRecordModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !props.busy && props.onClose()}>
          <section className="modal-panel add-record-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">{props.fund.name}</p>
                <h2 id="addRecordModalTitle">添加记录</h2>
              </div>
              <button className="icon-button light" type="button" aria-label="关闭" disabled={props.busy} onClick={props.onClose}>×</button>
            </div>
            <div className="trade-type-switch add-record-mode-switch" role="group" aria-label="记录类别">
              <button className={mode === "trade" ? "active" : ""} type="button" aria-pressed={mode === "trade"} disabled={props.busy} onClick={() => setMode("trade")}>买入与卖出</button>
              <button className={mode === "corporateAction" ? "active" : ""} type="button" aria-pressed={mode === "corporateAction"} disabled={props.busy} onClick={() => setMode("corporateAction")}>分红与公司行为</button>
            </div>
            {mode === "trade" ? (
              <TradeForm
                busy={props.busy}
                isStock={props.fund.assetType === "stock"}
                availableShares={props.fund.position?.totalShares}
                navPoints={props.navPoints}
                tradeType={props.tradeType}
                tradeDate={props.tradeDate}
                tradeAmount={props.tradeAmount}
                tradePrice={props.tradePrice}
                tradeShares={props.tradeShares}
                tradeFee={props.tradeFee}
                tradeNote={props.tradeNote}
                onTypeChange={props.onTypeChange}
                onDateChange={props.onDateChange}
                onAmountChange={props.onAmountChange}
                onPriceChange={props.onPriceChange}
                onSharesChange={props.onSharesChange}
                onFeeChange={props.onFeeChange}
                onNoteChange={props.onNoteChange}
                onSubmit={props.onSubmit}
              />
            ) : (
              <DividendForm
                busy={props.busy}
                isStock={props.fund.assetType === "stock"}
                type={props.dividendType}
                date={props.dividendDate}
                amount={props.dividendAmount}
                nav={props.dividendNav}
                shares={props.dividendShares}
                note={props.dividendNote}
                onTypeChange={props.onDividendTypeChange}
                onDateChange={props.onDividendDateChange}
                onAmountChange={props.onDividendAmountChange}
                onNavChange={props.onDividendNavChange}
                onSharesChange={props.onDividendSharesChange}
                onNoteChange={props.onDividendNoteChange}
                onSubmit={props.onDividendSubmit}
              />
            )}
          </section>
        </div>
  );
}
