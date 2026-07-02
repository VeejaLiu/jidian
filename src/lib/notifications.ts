export type AppNoticeTone = "error" | "success";

export interface AppNotice {
  id: number;
  tone: AppNoticeTone;
  message: string;
}

type Listener = (notice: AppNotice) => void;

const listeners = new Set<Listener>();
let noticeId = 1;

function emit(tone: AppNoticeTone, message: string) {
  const text = String(message || "").trim();
  if (!text) return;
  const notice: AppNotice = {
    id: noticeId,
    tone,
    message: text,
  };
  noticeId += 1;
  listeners.forEach((listener) => listener(notice));
}

export function subscribeNotice(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyError(message: string) {
  emit("error", message);
}

export function notifySuccess(message: string) {
  emit("success", message);
}
