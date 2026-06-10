export type TradeType = "buy" | "sell";

export interface UserAccount {
  id: number;
  name: string;
}

export interface NavPoint {
  id?: number;
  date: string;
  nav: number;
  accumulatedNav?: number | null;
  previousNav?: number | null;
  dailyChangePercent?: number | null;
}

export interface TradeRecord {
  id: number;
  type: TradeType;
  date: string;
  nav: number | null;
  amount: number;
  shares: number | null;
  status?: "pending" | "confirmed";
  note?: string | null;
}

export interface FundPosition {
  totalAmount?: number | null;
  totalShares?: number | null;
  averageCost?: number | null;
  realizedAmount?: number | null;
  realizedCost?: number | null;
  realizedProfit?: number | null;
}

export interface FundStatus {
  lastBuyDate?: string | null;
  lastBuyNav?: number | null;
  latestNavDate?: string | null;
  latestNav?: number | null;
  triggerNav?: number | null;
  requiredDropPercent?: number | null;
  state?: string | null;
}

export interface Fund {
  id: number;
  code?: string | null;
  name: string;
  fundType?: string | null;
  dropRate?: number | null;
  lastNavSyncAt?: string | null;
  status?: FundStatus;
  position?: FundPosition;
  navHistory?: NavPoint[];
  trades?: TradeRecord[];
  buys?: TradeRecord[];
}

export interface ChartData {
  nav: NavPoint[];
  trades: TradeRecord[];
  buys?: TradeRecord[];
  position: FundPosition | null;
}

export interface NavHistoryPage {
  rows: NavPoint[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
