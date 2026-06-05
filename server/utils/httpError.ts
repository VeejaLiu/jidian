export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function toHttpError(message: string, status = 400) {
  return new HttpError(message, status);
}
