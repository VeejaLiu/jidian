import { useRef, useState } from "react";
import { ViewportMenu } from "../ViewportMenu";
import type { Fund } from "../../types/fund";

export type FundAction = "dropRate" | "syncNav" | "manualPrice" | "hideFund";

interface FundActionMenuProps {
  busy: boolean;
  fund: Fund;
  onSelect: (action: FundAction) => void;
}

export function FundActionMenu({ busy, fund, onSelect }: FundActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isStock = fund.assetType === "stock";

  const selectAction = (action: FundAction) => {
    setOpen(false);
    onSelect(action);
  };

  return (
    <div className="fund-action-menu" ref={menuRef}>
      <button
        className="fund-action-button"
        type="button"
        aria-label="资产操作"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open && (
        <ViewportMenu className="fund-action-panel" anchorRef={menuRef} onClose={() => setOpen(false)}>
          {!isStock && (
            <button type="button" role="menuitem" onClick={() => selectAction("dropRate")}>
              <strong>修改跌幅阈值</strong>
              <span>调整这只基金的定投触发幅度</span>
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => selectAction("syncNav")}>
            <strong>{isStock ? "同步价格" : "更新净值"}</strong>
            <span>{isStock ? "手动拉取最新历史价格" : "手动拉取最新历史净值"}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => selectAction("manualPrice")}>
            <strong>{isStock ? "补录价格" : "补录净值"}</strong>
            <span>{isStock ? "手动添加某一天的收盘价" : "手动添加某一天的单位净值"}</span>
          </button>
          <button className="danger" type="button" role="menuitem" onClick={() => selectAction("hideFund")}>
            <strong>隐藏资产</strong>
            <span>从左侧列表移除，保留交易和价格数据</span>
          </button>
        </ViewportMenu>
      )}
    </div>
  );
}
