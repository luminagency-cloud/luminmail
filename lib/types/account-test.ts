export type AccountCheckResult = {
  ok: boolean;
  message: string;
};

export type AccountTestResult = {
  imap: AccountCheckResult;
  smtp: AccountCheckResult;
};
