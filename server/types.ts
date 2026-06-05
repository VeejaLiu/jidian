export type TradeType = "buy" | "sell";

export interface TradeRecord {
  id?: number;
  type: TradeType;
  date: string;
  nav: number | null;
  amount: number;
  shares: number | null;
  status?: "pending" | "confirmed";
  note?: string | null;
}
