import * as cheerio from "cheerio";
import { logWarn } from "../utils/logger";

export type PriceHistoryFetchResult = {
  rows: Array<{
    date: string;
    nav: number;
    accumulatedNav: number | null;
    openPrice?: number | null;
    closePrice?: number | null;
    highPrice?: number | null;
    lowPrice?: number | null;
  }>;
  assetName?: string;
  sourceRecords: number;
  sourcePages: number;
  fetchedPages: number;
};

export async function fetchFundProfile(code: string) {
  const url = new URL("https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx");
  url.searchParams.set("m", "1");
  url.searchParams.set("key", code);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 FundDCA/1.0",
      Referer: "https://fund.eastmoney.com/",
    },
  });
  if (!response.ok) return null;

  const payload = await response.json() as any;
  const exact = payload?.Datas?.find((item: any) => item.CODE === code || item._id === code);
  if (!exact) return null;

  return {
    code,
    name: exact.NAME || exact.FundBaseInfo?.SHORTNAME || code,
    fundType: exact.FundBaseInfo?.FTYPE || "",
  };
}

function normalizeStockCode(code: string) {
  const trimmed = String(code || "").trim().toUpperCase();
  if (/^(SH|SZ)\d{6}$/.test(trimmed)) return trimmed;
  if (/^6\d{5}$/.test(trimmed)) return `SH${trimmed}`;
  if (/^(0|3)\d{5}$/.test(trimmed)) return `SZ${trimmed}`;
  return trimmed;
}

function resolveEastmoneySecid(code: string) {
  const normalized = normalizeStockCode(code);
  if (/^SH\d{6}$/.test(normalized)) return `1.${normalized.slice(2)}`;
  if (/^SZ\d{6}$/.test(normalized)) return `0.${normalized.slice(2)}`;
  throw new Error("暂只支持 A 股代码，例如 600519、000001、300750");
}

function resolveTencentSymbol(code: string) {
  const normalized = normalizeStockCode(code);
  if (/^SH\d{6}$/.test(normalized)) return `sh${normalized.slice(2)}`;
  if (/^SZ\d{6}$/.test(normalized)) return `sz${normalized.slice(2)}`;
  throw new Error("暂只支持 A 股代码，例如 600519、000001、300750");
}

function parseNavResponse(text: string) {
  const contentMatch = text.match(/content:"([\s\S]*?)",records:/);
  const recordsMatch = text.match(/records:(\d+)/);
  const pagesMatch = text.match(/pages:(\d+)/);
  if (!contentMatch || !recordsMatch) {
    const error = new Error("净值数据源返回异常，未包含可解析的历史净值数据") as Error & { status?: number };
    error.status = 502;
    throw error;
  }
  const html = contentMatch ? contentMatch[1].replace(/\\"/g, '"') : "";
  const $ = cheerio.load(html);
  const rows: Array<{ date: string; nav: number; accumulatedNav: number | null }> = [];

  $("tbody tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((__, td) => $(td).text().trim())
      .get();
    if (cells.length < 3) return;

    const navDate = cells[0];
    const unitNav = Number(cells[1]);
    const accumulatedNav = Number(cells[2]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(navDate) || !Number.isFinite(unitNav)) return;

    rows.push({
      date: navDate,
      nav: unitNav,
      accumulatedNav: Number.isFinite(accumulatedNav) ? accumulatedNav : null,
    });
  });

  return {
    rows,
    records: Number(recordsMatch?.[1] || rows.length),
    pages: Number(pagesMatch?.[1] || 1),
  };
}

type FundNavRow = { date: string; nav: number; accumulatedNav: number | null };

function parseFundNavJson(payload: any) {
  const list = Array.isArray(payload?.Data?.LSJZList) ? payload.Data.LSJZList : [];
  const rows = list
    .map((item: any) => {
      const date = String(item?.FSRQ || "");
      const nav = Number(item?.DWJZ);
      const accumulatedNav = Number(item?.LJJZ);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(nav) || nav <= 0) return null;
      return {
        date,
        nav,
        accumulatedNav: Number.isFinite(accumulatedNav) && accumulatedNav > 0 ? accumulatedNav : null,
      };
    })
    .filter(Boolean) as FundNavRow[];

  if (payload?.ErrCode && payload.ErrCode !== 0) {
    const error = new Error(`净值数据源请求失败：${payload.ErrMsg || payload.ErrCode}`) as Error & { status?: number };
    error.status = 502;
    throw error;
  }

  return rows;
}

async function fetchNavHistoryFromJson(code: string, startDate: string, endDate: string) {
  const rows: FundNavRow[] = [];
  let page = 1;
  let fetchedPages = 0;

  while (true) {
    const url = new URL("https://api.fund.eastmoney.com/f10/lsjz");
    url.searchParams.set("fundCode", code);
    url.searchParams.set("pageIndex", String(page));
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("startDate", startDate || "");
    url.searchParams.set("endDate", endDate || "");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 FundDCA/1.0",
        Referer: `https://fund.eastmoney.com/${code}.html`,
      },
    });
    if (!response.ok) {
      const error = new Error(`净值数据源暂时不可用（HTTP ${response.status}）`) as Error & { status?: number };
      error.status = 502;
      throw error;
    }

    const pageRows = parseFundNavJson(await response.json());
    rows.push(...pageRows);
    fetchedPages += 1;
    if (pageRows.length < 100) break;
    page += 1;
  }

  return {
    rows,
    sourceRecords: rows.length,
    sourcePages: fetchedPages,
    fetchedPages,
  } satisfies PriceHistoryFetchResult;
}

async function fetchNavPage({ code, page, startDate, endDate }: { code: string; page: number; startDate: string; endDate: string }) {
  const url = new URL("https://fundf10.eastmoney.com/F10DataApi.aspx");
  url.searchParams.set("type", "lsjz");
  url.searchParams.set("code", code);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per", "20");
  url.searchParams.set("sdate", startDate || "");
  url.searchParams.set("edate", endDate || "");
  url.searchParams.set("rt", String(Date.now()));

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 FundDCA/1.0",
      Referer: `https://fundf10.eastmoney.com/jjjz_${code}.html`,
    },
  });

  if (!response.ok) {
    const error = new Error("净值数据源暂时不可用") as Error & { status?: number };
    error.status = 502;
    throw error;
  }

  const text = await response.text();
  return parseNavResponse(text);
}

const FULL_NAV_SYNC_BATCH_DELAY_MS = 80;

export async function fetchNavHistory(code: string, startDate: string, endDate: string) {
  try {
    return await fetchNavHistoryFromJson(code, startDate, endDate);
  } catch (error) {
    logWarn(`[fund-nav] ${new Date().toISOString()} JSON 数据源失败，回退旧接口 code=${code} error=${error instanceof Error ? error.message : String(error)}`);
    const firstPage = await fetchNavPage({ code, page: 1, startDate, endDate });
    const allRows = [...firstPage.rows];
    const pages = firstPage.pages || 1;

    for (let page = 2; page <= pages; page += 1) {
      const result = await fetchNavPage({ code, page, startDate, endDate });
      allRows.push(...result.rows);
      if (!startDate && page % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, FULL_NAV_SYNC_BATCH_DELAY_MS));
      }
    }

    return {
      rows: allRows,
      sourceRecords: firstPage.records,
      sourcePages: firstPage.pages,
      fetchedPages: pages,
    } satisfies PriceHistoryFetchResult;
  }
}

type StockPriceRow = {
  date: string;
  nav: number;
  accumulatedNav: number | null;
  openPrice: number | null;
  closePrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
};

function parseEastmoneyDateInput(value: string, fallback: string) {
  return value ? value.replace(/-/g, "") : fallback;
}

async function requestJson(url: URL, headers: Record<string, string>, context: Record<string, unknown> = {}) {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`) as Error & { status?: number };
      error.status = 502;
      throw error;
    }
    return await response.json() as any;
  } catch (error) {
    const details = Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    const cause = error && typeof error === "object" && "cause" in error ? (error as { cause?: unknown }).cause : undefined;
    const causeText = error instanceof Error ? (cause instanceof Error ? cause.message : error.message) : String(error);
    const wrapped = new Error(`请求数据源失败 host=${url.host} ${details} cause=${causeText}`) as Error & { status?: number };
    wrapped.status = 502;
    throw wrapped;
  }
}

export async function fetchStockPriceHistory(code: string, startDate: string, endDate: string) {
  const secid = resolveEastmoneySecid(code);
  const url = new URL("https://push2his.eastmoney.com/api/qt/stock/kline/get");
  url.searchParams.set("secid", secid);
  url.searchParams.set("klt", "101");
  // Holdings and transactions use the broker's actual share count and price.
  // Keep market data unadjusted so corporate actions are applied exactly once.
  url.searchParams.set("fqt", "0");
  url.searchParams.set("lmt", "100000");
  url.searchParams.set("end", parseEastmoneyDateInput(endDate, "20500101"));
  url.searchParams.set("beg", parseEastmoneyDateInput(startDate, "19900101"));
  url.searchParams.set("fields1", "f1,f2,f3,f4,f5,f6");
  url.searchParams.set("fields2", "f51,f52,f53,f54,f55,f56,f57,f58");

  try {
    const payload = await requestJson(
      url,
      {
        "User-Agent": "Mozilla/5.0 FundDCA/1.0",
        Referer: "https://quote.eastmoney.com/",
      },
      {
        type: "stock-kline",
        provider: "eastmoney",
        code,
        secid,
        beg: url.searchParams.get("beg"),
        end: url.searchParams.get("end"),
      },
    );
    const klines = payload?.data?.klines;
    if (!Array.isArray(klines)) {
      return {
        rows: [] as StockPriceRow[],
        assetName: cleanStockName(payload?.data?.name, code),
        sourceRecords: 0,
        sourcePages: 1,
        fetchedPages: 1,
      } satisfies PriceHistoryFetchResult;
    }

    const rows = klines
      .map((line: string) => {
        const [date, open, close, high, low] = String(line).split(",");
        const openPrice = Number(open);
        const closePrice = Number(close);
        const highPrice = Number(high);
        const lowPrice = Number(low);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(closePrice) || closePrice <= 0) return null;
        return {
          date,
          nav: closePrice,
          accumulatedNav: null,
          openPrice: Number.isFinite(openPrice) && openPrice > 0 ? openPrice : null,
          closePrice,
          highPrice: Number.isFinite(highPrice) && highPrice > 0 ? highPrice : null,
          lowPrice: Number.isFinite(lowPrice) && lowPrice > 0 ? lowPrice : null,
        };
      })
      .filter(Boolean) as StockPriceRow[];

    return {
      rows,
      assetName: cleanStockName(payload?.data?.name, code),
      sourceRecords: rows.length,
      sourcePages: 1,
      fetchedPages: 1,
    } satisfies PriceHistoryFetchResult;
  } catch (error) {
    logWarn(`[stock-price] ${new Date().toISOString()} eastmoney failed, fallback to tencent code=${code} error=${error instanceof Error ? error.message : String(error)}`);
    return fetchStockPriceHistoryFromTencent(code, startDate, endDate);
  }
}

async function fetchStockPriceHistoryFromTencent(code: string, startDate: string, endDate: string) {
  const symbol = resolveTencentSymbol(code);
  const url = new URL("https://web.ifzq.gtimg.cn/appstock/app/fqkline/get");
  const beginDate = startDate || "";
  const finishDate = endDate || "";
  url.searchParams.set("param", `${symbol},day,${beginDate},${finishDate},1000,qfq`);

  const payload = await requestJson(
    url,
    {
      "User-Agent": "Mozilla/5.0 FundDCA/1.0",
      Referer: "https://gu.qq.com/",
    },
    {
      type: "stock-kline",
      provider: "tencent",
      code,
      symbol,
      param: url.searchParams.get("param"),
    },
  );

  const node = payload?.data?.[symbol];
  const series = Array.isArray(node?.qfqday)
    ? node.qfqday
    : Array.isArray(node?.day)
      ? node.day
      : [];

  const rows = series
    .map((item: any) => {
      const date = String(Array.isArray(item) ? item[0] : "");
      const open = Number(Array.isArray(item) ? item[1] : NaN);
      const close = Number(Array.isArray(item) ? item[2] : NaN);
      const high = Number(Array.isArray(item) ? item[3] : NaN);
      const low = Number(Array.isArray(item) ? item[4] : NaN);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(close) || close <= 0) return null;
      return {
        date,
        nav: close,
        accumulatedNav: null,
        openPrice: Number.isFinite(open) && open > 0 ? open : null,
        closePrice: close,
        highPrice: Number.isFinite(high) && high > 0 ? high : null,
        lowPrice: Number.isFinite(low) && low > 0 ? low : null,
      };
    })
    .filter(Boolean) as StockPriceRow[];

  const assetName = cleanStockName(
    Array.isArray(node?.qt?.[symbol]) ? node.qt[symbol][1] : node?.name,
    code,
  );

  return {
    rows,
    assetName,
    sourceRecords: rows.length,
    sourcePages: 1,
    fetchedPages: 1,
  } satisfies PriceHistoryFetchResult;
}

export async function fetchStockProfile(code: string) {
  const result = await fetchStockPriceHistory(code, "", "");
  return {
    code,
    name: result.assetName || code,
    fundType: "股票",
  };
}

function cleanStockName(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}
