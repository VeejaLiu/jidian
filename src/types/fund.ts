export type TradeType = "buy" | "sell";
export type AssetType = "fund" | "stock";
export type DividendType = "cash" | "reinvest";

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

export interface DividendRecord {
  id: number;
  type: DividendType;
  date: string;
  amount: number;
  nav?: number | null;
  shares?: number | null;
  note?: string | null;
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
  dividendIncome?: number | null;
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

export interface FundSyncStatus {
  syncing?: boolean;
  reason?: string | null;
  hasPendingTrade?: boolean | null;
  lastTouchedAt?: number | null;
  nextSyncAt?: number | null;
  remainingMs?: number | null;
  intervalMs?: number | null;
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
  syncStatus?: FundSyncStatus;
  position?: FundPosition;
  navHistory?: NavPoint[];
  priceHistory?: NavPoint[];
  trades?: TradeRecord[];
  buys?: TradeRecord[];
  dividends?: DividendRecord[];
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
  dividends?: DividendRecord[];
  position: FundPosition | null;
}

export interface AccountSummaryAsset {
  id: number;
  name: string;
  code?: string | null;
  assetType?: AssetType | null;
  totalCost: number;
  totalShares: number;
  latestPrice?: number | null;
  marketValue: number;
  realizedProfit: number;
  totalProfit: number;
  xirr?: number | null;
}

export interface AccountSummary {
  accountId: number;
  totals: {
    totalCost: number;
    marketValue: number;
    realizedProfit: number;
    totalProfit: number;
    totalProfitRate: number | null;
    xirr?: number | null;
    fundMarketValue: number;
    stockMarketValue: number;
    assetCount: number;
  };
  assets: AccountSummaryAsset[];
}

export interface NavHistoryPage {
  rows: NavPoint[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
