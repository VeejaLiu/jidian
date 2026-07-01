import { AccountModal } from "./account/AccountModal";
import { BackupImportPreviewModal } from "./account/BackupImportPreviewModal";
import { AddFundModal } from "./fund/AddFundModal";
import { HiddenFundsModal } from "./fund/HiddenFundsModal";
import { NavHistoryModal } from "./nav/NavHistoryModal";
import { EditTradeModal } from "./trade/EditTradeModal";
import type { useAccounts } from "../hooks/useAccounts";
import type { useAssets } from "../hooks/useAssets";
import type { useBackupImportExport } from "../hooks/useBackupImportExport";
import type { useNavHistoryModal } from "../hooks/useNavHistoryModal";
import type { useTradeActions } from "../hooks/useTradeActions";
import type { useTradeForm } from "../hooks/useTradeForm";
import type { Fund } from "../types/fund";

interface AppDialogsProps {
  accounts: ReturnType<typeof useAccounts>;
  assets: ReturnType<typeof useAssets>;
  backup: ReturnType<typeof useBackupImportExport>;
  navHistory: ReturnType<typeof useNavHistoryModal>;
  tradeActions: ReturnType<typeof useTradeActions>;
  tradeForm: ReturnType<typeof useTradeForm>;
  busy: { active: boolean };
  accountModalOpen: boolean;
  addFundModalOpen: boolean;
  hiddenFundsModalOpen: boolean;
  onCloseAccountModal: () => void;
  onSelectAccount: (accountId: number) => void;
  onCloseAddFund: () => void;
  onCloseHiddenFunds: () => void;
  onPreviewHiddenFund: (fund: Fund) => void;
  onRestoreFund: (fund: Fund) => void;
}

export function AppDialogs({
  accounts,
  assets,
  backup,
  navHistory,
  tradeActions,
  tradeForm,
  busy,
  accountModalOpen,
  addFundModalOpen,
  hiddenFundsModalOpen,
  onCloseAccountModal,
  onSelectAccount,
  onCloseAddFund,
  onCloseHiddenFunds,
  onPreviewHiddenFund,
  onRestoreFund,
}: AppDialogsProps) {
  return (
    <>
      <AccountModal
        open={accountModalOpen}
        accounts={accounts.accounts}
        selectedAccount={accounts.selectedAccount}
        busy={busy.active}
        onClose={onCloseAccountModal}
        onSelectAccount={onSelectAccount}
        onCreateAccount={accounts.handleCreateAccount}
        onRenameAccount={accounts.handleRenameAccount}
        onDeleteAccount={accounts.handleDeleteAccount}
        onExportBackup={backup.handleExportBackup}
        onImportBackup={backup.handleImportBackup}
        onPreviewBackupImport={backup.handlePreviewBackupImport}
      />
      <BackupImportPreviewModal
        open={Boolean(backup.backupImportDraft)}
        fileName={backup.backupImportDraft?.file.name || ""}
        preview={backup.backupImportDraft?.preview || null}
        busy={busy.active}
        onCancel={() => backup.setBackupImportDraft(null)}
        onConfirm={backup.handleImportBackup}
      />
      <NavHistoryModal
        fund={assets.selectedFund}
        modal={navHistory.navModal}
        busy={busy.active}
        onClose={navHistory.closeNavModal}
        onPrev={navHistory.handlePrevNavPage}
        onNext={navHistory.handleNextNavPage}
      />
      <AddFundModal
        open={addFundModalOpen}
        draft={assets.assetDraft}
        busy={assets.addingFundBusy}
        onDraftChange={assets.setAssetDraft}
        onSubmit={assets.handleAddFund}
        onClose={onCloseAddFund}
      />
      <HiddenFundsModal
        open={hiddenFundsModalOpen}
        funds={assets.hiddenFunds}
        loading={assets.hiddenFundsLoading}
        busy={busy.active}
        onClose={onCloseHiddenFunds}
        onPreview={onPreviewHiddenFund}
        onRestore={onRestoreFund}
      />
      <EditTradeModal
        fund={assets.selectedFund}
        record={tradeForm.editingTrade}
        draft={tradeForm.editTradeDraft}
        busy={busy.active}
        onDraftChange={tradeForm.setEditTradeDraft}
        onSubmit={tradeActions.handleSubmitEditTrade}
        onClose={tradeActions.handleCloseEditTrade}
      />
    </>
  );
}
