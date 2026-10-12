import type { AppUser } from "./auth/auth.types";

export type RecordValue = Record<string, any>;
export type PageContext = {
  path: string;
  search: string;
  startupId: string;
  startup: RecordValue;
  capabilities: RecordValue;
  navigate: (path: string) => void;
  reloadWorkspace: () => void;
  user: AppUser;
};
