export type TradeType = "buy" | "sell";
export type AssetType = "fund" | "stock";
export type PositionStage = "opening" | "closing";

export interface TradeRecord {
  id?: number;
  type: TradeType;
  date: string;
  nav: number | null;
  amount: number | null;
  fee?: number | null;
  shares: number | null;
  status?: "pending" | "confirmed";
  note?: string | null;
  positionStage?: PositionStage | null;
}

export interface ImportedTradeRow {
  assetCode: string;
  assetName: string;
  assetType: AssetType;
  type: TradeType;
  date: string;
  price: number;
  quantity: number;
  amount: number;
  note?: string | null;
}

export type DividendType = "cash" | "reinvest" | "stock_bonus" | "capital_increase" | "dividend_tax";

export interface DividendRecord {
  id?: number;
  accountId?: number;
  fundId?: number;
  type: DividendType;
  date: string;
  amount: number | null;
  nav?: number | null;
  shares?: number | null;
  note?: string | null;
}
