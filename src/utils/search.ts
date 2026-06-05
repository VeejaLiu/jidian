import { pinyin } from "pinyin-pro";
import type { Fund } from "../types/fund";

function normalizeSearch(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getPinyinInitials(value: unknown) {
  const text = String(value || "");
  if (!text) return "";

  try {
    return pinyin(text, { pattern: "first", toneType: "none", type: "array" }).join("").toLowerCase();
  } catch {
    return "";
  }
}

export function fundMatchesSearch(fund: Fund, keyword: string) {
  const query = normalizeSearch(keyword);
  if (!query) return true;

  const name = normalizeSearch(fund.name);
  const code = normalizeSearch(fund.code);
  const fundType = normalizeSearch(fund.fundType);
  const initials = getPinyinInitials(fund.name);
  let fullPinyin = "";
  try {
    fullPinyin = pinyin(fund.name || "", { toneType: "none", type: "array" }).join("").toLowerCase();
  } catch {
    fullPinyin = "";
  }

  return [name, code, fundType, initials, fullPinyin].some((item) => item.includes(query));
}
