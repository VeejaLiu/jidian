import { useEffect, useRef, useState } from "react";

export type FundAction = "dropRate" | "syncNav" | "hideFund";

interface FundActionMenuProps {
  busy: boolean;
  onSelect: (action: FundAction) => void;
}

export function FundActionMenu({ busy, onSelect }: FundActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectAction = (action: FundAction) => {
    setOpen(false);
    onSelect(action);
  };

  return (
    <div className="fund-action-menu" ref={menuRef}>
      <button
        className="fund-action-button"
        type="button"
        aria-label="基金操作"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open && (
        <div className="fund-action-panel" role="menu">
          <button type="button" role="menuitem" onClick={() => selectAction("dropRate")}>
            <strong>修改跌幅阈值</strong>
            <span>调整这只基金的定投触发幅度</span>
          </button>
          <button type="button" role="menuitem" onClick={() => selectAction("syncNav")}>
            <strong>更新净值</strong>
            <span>手动拉取最新历史净值</span>
          </button>
          <button className="danger" type="button" role="menuitem" onClick={() => selectAction("hideFund")}>
            <strong>隐藏基金</strong>
            <span>从左侧列表移除，保留交易数据</span>
          </button>
        </div>
      )}
    </div>
  );
}
