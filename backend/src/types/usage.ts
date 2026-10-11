export type UsageProvider = 'apollo' | 'llm';
export type UsageStatus = 'success' | 'failed' | 'blocked';
export type UsageCostType = 'estimated' | 'reported';
export type EntitlementMetric = 'prospects' | 'dmSearches' | 'emails' | 'icps';

export interface UsageEntityRef {
  kind: string;
  id: string;
}

export interface UsageContext {
  startupId: string;
  requestId?: string;
  entityRef?: UsageEntityRef;
}

export interface UsageRecordQuery {
  provider?: UsageProvider;
  operation?: string;
  status?: UsageStatus;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface UsageCallResult<T> {
  value: T;
  actualCostPaise?: number;
  costType?: UsageCostType;
  creditsConsumed?: number;
}
