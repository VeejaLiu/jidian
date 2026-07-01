export type DropRateStrategyInput = {
  lastBuyNav?: number | null;
  latestNav?: number | null;
  dropRate?: number | null;
};

export function evaluateDropRateStrategy(input: DropRateStrategyInput) {
  const dropRate = Number(input.dropRate ?? 0.04);
  const lastBuyNav = Number(input.lastBuyNav);
  const latestNav = Number(input.latestNav);

  if (!Number.isFinite(lastBuyNav) || lastBuyNav <= 0) {
    return { state: "missing_buy" as const, triggerNav: null, requiredDropPercent: null };
  }

  const triggerNav = Number((lastBuyNav * (1 - (Number.isFinite(dropRate) ? dropRate : 0.04))).toFixed(6));
  if (!Number.isFinite(latestNav) || latestNav <= 0) {
    return { state: "missing_nav" as const, triggerNav, requiredDropPercent: null };
  }

  if (triggerNav >= latestNav) {
    return { state: "triggered" as const, triggerNav, requiredDropPercent: 0 };
  }

  return {
    state: "waiting" as const,
    triggerNav,
    requiredDropPercent: Number(((1 - triggerNav / latestNav) * 100).toFixed(4)),
  };
}
