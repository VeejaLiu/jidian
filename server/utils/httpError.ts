export class HttpError extends Error {
  status: number;
  publicMessage: string;

  constructor(message: string, status = 500, publicMessage = message) {
    super(message);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export function toHttpError(message: string, status = 400, publicMessage = message) {
  return new HttpError(message, status, publicMessage);
}

export function getHttpStatus(error: unknown) {
  const status = Number((error as { status?: number } | undefined)?.status);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
}

export function getPublicErrorMessage(error: unknown) {
  const status = getHttpStatus(error);
  if (error instanceof HttpError) return error.publicMessage;
  if (status === 502) return "数据源暂时不可用，请稍后重试";
  if (status >= 500) return "服务暂时不可用，请稍后重试";
  return error instanceof Error && error.message ? error.message : "操作失败";
}
