import { useMemo, type RefObject } from "react";
import type { Fund, UserAccount } from "../../types/fund";
import { fundMatchesSearch } from "../../utils/search";

interface FundSidebarProps {
  funds: Fund[];
  selectedAccount: UserAccount | null;
  selectedFundId: number | null;
  busy: boolean;
  addingBusy: boolean;
  searchValue: string;
  navigationOpen: boolean;
  onNavigationOpenChange: (open: boolean) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onOpenAddFund: () => void;
  onOpenHiddenFunds: () => void;
  onOpenAccountModal: () => void;
  onSelectFund: (fundId: number) => void;
}

export function FundSidebar({
  funds,
  selectedAccount,
  selectedFundId,
  busy,
  addingBusy,
  searchValue,
  navigationOpen,
  onNavigationOpenChange,
  searchInputRef,
  onSearchChange,
  onOpenAddFund,
  onOpenHiddenFunds,
  onOpenAccountModal,
  onSelectFund,
}: FundSidebarProps) {
  const visibleFunds = useMemo(
    () => funds.filter((fund) => fundMatchesSearch(fund, searchValue)),
    [funds, searchValue],
  );
  const groupedFunds = useMemo(() => {
    const fundItems = visibleFunds.filter((fund) => fund.assetType !== "stock");
    const stockItems = visibleFunds.filter((fund) => fund.assetType === "stock");
    return [
      { key: "fund", title: "基金", items: fundItems },
      { key: "stock", title: "股票", items: stockItems },
    ].filter((group) => group.items.length > 0);
  }, [visibleFunds]);

  return (
    <aside className={`fund-panel${navigationOpen ? " navigation-open" : ""}`} aria-label="资产列表">
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

        <button className="account-entry" type="button" disabled={busy} onClick={onOpenAccountModal}>
          <span className="account-entry-avatar">{selectedAccount?.name.slice(0, 1) || "账"}</span>
          <span>
            <small>当前账户</small>
            <strong>{selectedAccount?.name || "选择账户"}</strong>
          </span>
          <span className="account-entry-action">管理</span>
        </button>
      </div>

      <button
        className="fund-navigation-toggle"
        type="button"
        aria-expanded={navigationOpen}
        aria-controls="fund-navigation"
        onClick={() => onNavigationOpenChange(!navigationOpen)}
      >
        <span>{navigationOpen ? "收起资产列表" : "展开资产列表"}（{funds.length}）</span>
        <span aria-hidden="true">{navigationOpen ? "▴" : "▾"}</span>
      </button>

      <div className="fund-navigation" id="fund-navigation">
        <label className="fund-search">
          <span>搜索</span>
          <input
            ref={searchInputRef}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="代码 / 名称 / 拼音缩写"
            disabled={busy}
          />
        </label>
        <div className="fund-list">
          {visibleFunds.length === 0 ? (
            <p className="fund-meta">{funds.length === 0 ? "还没有资产。" : "没有匹配的资产。"}</p>
          ) : (
            groupedFunds.map((group) => (
              <section key={group.key} className="fund-group" aria-label={group.title}>
                <div className="fund-group-header">
                  <span>{group.title}</span>
                  <small>{group.items.length}</small>
                </div>
                <div className="fund-group-list">
                  {group.items.map((fund) => (
                    <button
                      key={fund.id}
                      className={`fund-item${fund.id === selectedFundId ? " active" : ""}`}
                      type="button"
                      disabled={busy || addingBusy}
                      onClick={() => {
                        onSelectFund(fund.id);
                        onNavigationOpenChange(false);
                      }}
                      title={fund.name}
                    >
                      <span className="fund-name-row">
                        <span className="fund-name">{fund.name}</span>
                        {fund.status?.state === "triggered" && <span className="fund-warning-badge">已触发</span>}
                      </span>
                      <span className="fund-meta">
                        {[fund.code, fund.fundType].filter(Boolean).join(" / ") || "未填写代码"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <div className="fund-panel-bottom">
        <button className="fund-item add-fund-trigger" type="button" aria-label="添加资产" disabled={busy || addingBusy} onClick={onOpenAddFund}>
          <span className="plus-mark">+</span>
        </button>
      </div>
    </aside>
  );
}
