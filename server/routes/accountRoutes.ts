import { Router } from "express";
import { createAccount, deleteAccount, listAccounts, renameAccount } from "../services/accounts";

export const accountRoutes = Router();

accountRoutes.get("/api/accounts", (req, res) => {
  res.json({ accounts: listAccounts() });
});

accountRoutes.post("/api/accounts", (req, res, next) => {
  try {
    res.status(201).json({ account: createAccount(req.body) });
  } catch (error) {
    next(error);
  }
});

accountRoutes.put("/api/accounts/:id", (req, res, next) => {
  try {
    res.json({ account: renameAccount(Number(req.params.id), req.body) });
  } catch (error) {
    next(error);
  }
});

accountRoutes.delete("/api/accounts/:id", (req, res, next) => {
  try {
    res.json(deleteAccount(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});
