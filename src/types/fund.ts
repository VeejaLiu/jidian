export type TradeType = "buy" | "sell";
export type AssetType = "fund" | "stock";

export interface UserAccount {
  id: number;
  name: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  meta: {
    accountCount: number;
    assetCount: number;
    hiddenAssetCount: number;
    tradeCount: number;
    priceHistoryCount: number;
  };
  tables: Record<string, any[]>;
}

export interface NavPoint {
  id?: number;
  date: string;
  nav: number;
  price?: number;
  openPrice?: number | null;
  closePrice?: number | null;
  highPrice?: number | null;
  lowPrice?: number | null;
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
  fee?: number | null;
  shares: number | null;
  status?: "pending" | "confirmed";
  note?: string | null;
  sellReturnRate?: number | null;
}

export interface TradeDraft {
  type: TradeType;
  date: string;
  amount: string;
  price: string;
  shares: string;
  fee: string;
  note: string;
}

export interface FundPosition {
  totalAmount?: number | null;
  totalShares?: number | null;
  averageCost?: number | null;
  displayAverageCost?: number | null;
  displayAverageCostLabel?: string | null;
  hasOpenPosition?: boolean | null;
  realizedAmount?: number | null;
  realizedCost?: number | null;
  realizedProfit?: number | null;
}

export interface FundStatus {
  lastBuyDate?: string | null;
  lastBuyNav?: number | null;
  lastBuyPrice?: number | null;
  latestNavDate?: string | null;
  latestNav?: number | null;
  latestPriceDate?: string | null;
  latestPrice?: number | null;
  triggerNav?: number | null;
  triggerPrice?: number | null;
  requiredDropPercent?: number | null;
  state?: string | null;
}

export interface Fund {
  id: number;
  code?: string | null;
  name: string;
  assetType?: AssetType | null;
  fundType?: string | null;
  dropRate?: number | null;
  lastNavSyncAt?: string | null;
  lastPriceSyncAt?: string | null;
  status?: FundStatus;
  position?: FundPosition;
  navHistory?: NavPoint[];
  priceHistory?: NavPoint[];
  trades?: TradeRecord[];
  buys?: TradeRecord[];
}

export interface AssetDraft {
  assetType: AssetType;
  code: string;
  name: string;
}

export interface ChartData {
  nav: NavPoint[];
  prices?: NavPoint[];
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
