import { db } from "../db/database";
import { toHttpError } from "../utils/httpError";
import { cleanText } from "../utils/validators";

export interface UserAccount {
  id: number;
  name: string;
}

export function listAccounts() {
  return db
    .prepare("SELECT id, name FROM user_accounts ORDER BY id ASC")
    .all() as UserAccount[];
}

export function getDefaultAccountId() {
  const account = db
    .prepare("SELECT id FROM user_accounts ORDER BY id ASC LIMIT 1")
    .get() as { id: number } | undefined;
  if (!account) throw toHttpError("还没有可用账户", 500);
  return account.id;
}

export function getAccountById(accountId: number) {
  return db
    .prepare("SELECT id, name FROM user_accounts WHERE id = ?")
    .get(accountId) as UserAccount | undefined;
}

export function getAccountIdFromRequest(req: any) {
  const rawAccountId = req.query.accountId ?? req.body?.accountId;
  const accountId = rawAccountId === undefined || rawAccountId === "" ? getDefaultAccountId() : Number(rawAccountId);
  if (!Number.isInteger(accountId) || accountId <= 0 || !getAccountById(accountId)) {
    throw toHttpError("账户不存在", 404);
  }
  return accountId;
}

export function createAccount(body: any) {
  const name = cleanText(body.name);
  if (!name) throw toHttpError("请填写账户名称", 400);

  const result = db.prepare("INSERT INTO user_accounts (name) VALUES (?)").run(name);
  return getAccountById(Number(result.lastInsertRowid));
}

export function renameAccount(accountId: number, body: any) {
  const name = cleanText(body.name);
  if (!name) throw toHttpError("请填写账户名称", 400);

  const result = db.prepare("UPDATE user_accounts SET name = ? WHERE id = ?").run(name, accountId);
  if (result.changes === 0) throw toHttpError("账户不存在", 404);

  return getAccountById(accountId);
}

export function deleteAccount(accountId: number) {
  const accountCount = (db
    .prepare("SELECT COUNT(*) AS total FROM user_accounts")
    .get() as { total: number }).total;
  if (accountCount <= 1) throw toHttpError("至少保留一个账户", 400);

  if (!getAccountById(accountId)) throw toHttpError("账户不存在", 404);

  const remove = db.transaction(() => {
    db.prepare("DELETE FROM trade_records WHERE account_id = ?").run(accountId);
    db.prepare("DELETE FROM buy_records WHERE account_id = ?").run(accountId);
    db.prepare("DELETE FROM user_funds WHERE account_id = ?").run(accountId);
    db.prepare("DELETE FROM user_accounts WHERE id = ?").run(accountId);
  });
  remove();

  return { ok: true };
}
