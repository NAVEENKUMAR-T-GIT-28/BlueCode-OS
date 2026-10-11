export interface ProspectFirmographics {
  industry?: string;
  employeeCount?: number;
  country?: string;
  region?: string;
  revenueRange?: string;
  technologies?: string[];
  keywords?: string[];
  openJobCount?: number;
  latestFundingStage?: string;
}

export interface OrganizationCandidate {
  apolloOrganizationId: string;
  name: string;
  domain?: string;
  firmographics?: ProspectFirmographics;
}

export interface OrganizationSearchResult {
  items: OrganizationCandidate[];
  hasMore: boolean;
}

export interface OrganizationSearchInput {
  criteria: Record<string, string[] | undefined>;
  page: number;
  perPage: number;
}

/** The only discovery-provider contract consumed by the service layer. */
export interface SalesDataProvider {
  searchOrganizations(input: OrganizationSearchInput): Promise<OrganizationSearchResult>;
}
