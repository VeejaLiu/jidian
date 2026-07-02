import { useEffect, useMemo, useState } from "react";
import { subscribeNotice, type AppNotice } from "../lib/notifications";

const NOTICE_DURATION_MS = 4000;

export function AppNoticeRegion() {
  const [notices, setNotices] = useState<AppNotice[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeNotice((notice) => {
      setNotices((current) => [...current, notice]);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!notices.length) return;
    const timers = notices.map((notice) => window.setTimeout(() => {
      setNotices((current) => current.filter((item) => item.id !== notice.id));
    }, NOTICE_DURATION_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [notices]);

  const visibleNotices = useMemo(() => notices.slice(-3), [notices]);

  if (!visibleNotices.length) return null;

  return (
    <div className="app-notice-region" aria-live="polite" aria-atomic="true">
      {visibleNotices.map((notice) => (
        <div key={notice.id} className={`app-notice ${notice.tone}`}>
          <div>
            <strong>{notice.tone === "error" ? "操作失败" : "操作完成"}</strong>
            <p>{notice.message}</p>
          </div>
          <button
            type="button"
            className="icon-button light"
            aria-label="关闭提示"
            onClick={() => setNotices((current) => current.filter((item) => item.id !== notice.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
