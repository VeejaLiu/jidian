import { useMemo } from "react";
import type { Fund } from "../../types/fund";
import { fundMatchesSearch } from "../../utils/search";

interface FundSidebarProps {
  funds: Fund[];
  selectedFundId: number | null;
  busy: boolean;
  addingBusy: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onOpenAddFund: () => void;
  onOpenHiddenFunds: () => void;
  onSelectFund: (fundId: number) => void;
}

export function FundSidebar({
  funds,
  selectedFundId,
  busy,
  addingBusy,
  searchValue,
  onSearchChange,
  onOpenAddFund,
  onOpenHiddenFunds,
  onSelectFund,
}: FundSidebarProps) {
  const visibleFunds = useMemo(
    () => funds.filter((fund) => fundMatchesSearch(fund, searchValue)),
    [funds, searchValue],
  );

  return (
    <aside className="fund-panel" aria-label="基金列表">
      <div className="fund-panel-top">
        <div className="panel-header">
          <div>
            <p className="eyebrow">4% 定投法</p>
            <h1>基点</h1>
          </div>
          <button className="sidebar-text-button" type="button" disabled={busy || addingBusy} onClick={onOpenHiddenFunds}>
            隐藏列表
          </button>
        </div>

        <label className="fund-search">
          <span>搜索</span>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="代码 / 名称 / 拼音缩写"
            disabled={busy}
          />
        </label>
      </div>

      <div className="fund-list">
        {visibleFunds.length === 0 ? (
          <p className="fund-meta">{funds.length === 0 ? "还没有基金。" : "没有匹配的基金。"}</p>
        ) : (
          visibleFunds.map((fund) => (
            <button
              key={fund.id}
              className={`fund-item${fund.id === selectedFundId ? " active" : ""}`}
              type="button"
              disabled={busy || addingBusy}
              onClick={() => onSelectFund(fund.id)}
            >
              <span className="fund-name">{fund.name}</span>
              <span className="fund-meta">
                {[fund.code, fund.fundType].filter(Boolean).join(" / ") || "未填写代码"}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="fund-panel-bottom">
        <button className="fund-item add-fund-trigger" type="button" disabled={busy || addingBusy} onClick={onOpenAddFund}>
          <span className="plus-mark">+</span>
        </button>
      </div>
    </aside>
  );
}
