export type TradeType = "buy" | "sell";
export type AssetType = "fund" | "stock";

export interface TradeRecord {
  id?: number;
  type: TradeType;
  date: string;
  nav: number | null;
  amount: number;
  fee?: number | null;
  shares: number | null;
  status?: "pending" | "confirmed";
  note?: string | null;
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
