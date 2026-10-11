export type StartupPlan = 'trial' | 'starter' | 'growth' | 'pro';
export type StartupStatus = 'active' | 'trial_expired' | 'suspended';
export type StartupRole = 'owner' | 'admin' | 'member';
export type MembershipStatus = 'invited' | 'active' | 'removed';

export interface StartupSettingsPatch {
  calendarLink?: string;
  senderName?: string;
  senderTitle?: string;
  productSummary?: string;
}

export interface UpdateStartupInput {
  name?: string;
  settings?: StartupSettingsPatch;
}
