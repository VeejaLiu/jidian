import * as cheerio from "cheerio";

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

function parseNavResponse(text: string) {
  const contentMatch = text.match(/content:"([\s\S]*?)",records:/);
  const recordsMatch = text.match(/records:(\d+)/);
  const pagesMatch = text.match(/pages:(\d+)/);
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
  };
}
