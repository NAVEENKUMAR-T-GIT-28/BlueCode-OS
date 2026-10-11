import type {
  OrganizationCandidate,
  OrganizationSearchInput,
  OrganizationSearchResult,
  SalesDataProvider,
} from './sales-data-provider.js';

// Every record is synthetic. The .example domains are reserved for documentation and are not companies.
const FIXTURES: readonly OrganizationCandidate[] = [
  {
    apolloOrganizationId: 'mock-org-hr-001',
    name: 'Mock Workforce Cloud 001',
    domain: 'mock-workforce-001.example',
    firmographics: {
      industry: 'Human Resources Software', employeeCount: 180, country: 'United Kingdom',
      region: 'England', revenueRange: '1M-5M', technologies: ['HRMS', 'Payroll'],
      keywords: ['synthetic HRMS fixture', 'synthetic payroll fixture'], openJobCount: 4,
    },
  },
  {
    apolloOrganizationId: 'mock-org-hr-002',
    name: 'Mock People Operations 002',
    domain: 'mock-people-ops-002.example',
    firmographics: {
      industry: 'Payroll Software', employeeCount: 420, country: 'United States',
      region: 'California', revenueRange: '5M-10M', technologies: ['Payroll', 'HRIS'],
      keywords: ['synthetic payroll fixture'], openJobCount: 7,
    },
  },
  {
    apolloOrganizationId: 'mock-org-accounting-001',
    name: 'Mock Ledger Systems 001',
    domain: 'mock-ledger-001.example',
    firmographics: {
      industry: 'Accounting Software', employeeCount: 95, country: 'India',
      region: 'Tamil Nadu', revenueRange: '1M-5M', technologies: ['Accounting', 'Bookkeeping'],
      keywords: ['synthetic finance software fixture'], openJobCount: 2,
    },
  },
  {
    apolloOrganizationId: 'mock-org-crm-001',
    name: 'Mock Customer Pipeline 001',
    domain: 'mock-pipeline-001.example',
    firmographics: {
      industry: 'CRM Software', employeeCount: 260, country: 'Canada',
      region: 'Ontario', revenueRange: '5M-10M', technologies: ['CRM', 'Sales Automation'],
      keywords: ['synthetic CRM fixture', 'synthetic sales pipeline fixture'], openJobCount: 5,
    },
  },
  {
    apolloOrganizationId: 'mock-org-security-001',
    name: 'Mock Security Operations 001',
    domain: 'mock-security-001.example',
    firmographics: {
      industry: 'Cybersecurity Software', employeeCount: 610, country: 'Australia',
      region: 'New South Wales', revenueRange: '10M-25M', technologies: ['Cloud Security', 'SIEM'],
      keywords: ['synthetic security fixture'], openJobCount: 11,
    },
  },
  {
    apolloOrganizationId: 'mock-org-health-001',
    name: 'Mock Care Systems 001',
    domain: 'mock-care-001.example',
    firmographics: {
      industry: 'Healthcare Technology', employeeCount: 75, country: 'United Kingdom',
      region: 'Scotland', revenueRange: 'Under 1M', technologies: ['Health Software'],
      keywords: ['synthetic healthcare fixture'], openJobCount: 3,
    },
  },
  {
    apolloOrganizationId: 'mock-org-bi-001',
    name: 'Mock Insight Analytics 001',
    domain: 'mock-insight-001.example',
    firmographics: {
      industry: 'Business Intelligence Software', employeeCount: 130, country: 'United States',
      region: 'New York', revenueRange: '1M-5M', technologies: ['Analytics', 'BI'],
      keywords: ['synthetic analytics fixture'], openJobCount: 6,
    },
  },
  {
    apolloOrganizationId: 'mock-org-general-001',
    name: 'Mock Business Systems 001',
    domain: 'mock-business-001.example',
    firmographics: {
      industry: 'Business Software', employeeCount: 35, country: 'India',
      region: 'Karnataka', revenueRange: 'Under 1M', technologies: ['Workflow Automation'],
      keywords: ['synthetic general software fixture'], openJobCount: 1,
    },
  },
];

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchAny(criteria: string[] | undefined, actual: Array<string | undefined>): boolean {
  if (!criteria?.length) return true;
  const candidates = actual.filter((value): value is string => Boolean(value)).map(normalized).filter(Boolean);
  return criteria.some(raw => {
    const wanted = normalized(raw);
    return Boolean(wanted) && candidates.some(candidate => candidate.includes(wanted) || wanted.includes(candidate));
  });
}

function employeeCountMatches(count: number | undefined, ranges: string[] | undefined): boolean {
  if (!ranges?.length) return true;
  if (count === undefined) return false;
  return ranges.some(raw => {
    const values = raw.match(/\d[\d,]*/g)?.map(value => Number(value.replace(/,/g, ''))) ?? [];
    if (values.length === 0 || values.some(value => !Number.isFinite(value))) return false;
    const lowerText = raw.toLowerCase();
    if (/\+|or more|and above|above|over|greater than/.test(lowerText)) return count >= values[0]!;
    if (/under|less than|below|up to|at most/.test(lowerText)) return count <= values.at(-1)!;
    if (values.length >= 2) return count >= values[0]! && count <= values[1]!;
    return count === values[0];
  });
}

function matchesCriteria(candidate: OrganizationCandidate, criteria: Record<string, string[] | undefined>): boolean {
  const firmographics = candidate.firmographics ?? {};
  if (!matchAny(criteria.industries, [firmographics.industry])) return false;
  if (!matchAny(criteria.countries, [firmographics.country])) return false;
  if (!matchAny(criteria.regions, [firmographics.region])) return false;
  if (!matchAny(criteria.revenueRanges, [firmographics.revenueRange])) return false;
  if (!matchAny(criteria.technologies, firmographics.technologies ?? [])) return false;
  if (!matchAny(criteria.companyKeywords, [candidate.name, ...(firmographics.keywords ?? [])])) return false;
  if (!employeeCountMatches(firmographics.employeeCount, criteria.employeeRanges)) return false;

  const excludedIndustries = (criteria.excludedIndustries ?? []).map(normalized);
  if (excludedIndustries.some(excluded => excluded && normalized(firmographics.industry ?? '').includes(excluded))) return false;
  const excludedCompanies = (criteria.excludedCompanies ?? []).map(normalized);
  if (excludedCompanies.some(excluded => excluded && normalized(candidate.name).includes(excluded))) return false;
  return true;
}

/** Returns only clearly labelled synthetic records; this class never performs network I/O. */
export class ApolloMock implements SalesDataProvider {
  async searchOrganizations(input: OrganizationSearchInput): Promise<OrganizationSearchResult> {
    const matched = FIXTURES.filter(item => matchesCriteria(item, input.criteria));
    const start = (input.page - 1) * input.perPage;
    const items = matched.slice(start, start + input.perPage).map(item => ({
      ...item,
      ...(item.firmographics ? { firmographics: { ...item.firmographics,
        ...(item.firmographics.technologies ? { technologies: [...item.firmographics.technologies] } : {}),
        ...(item.firmographics.keywords ? { keywords: [...item.firmographics.keywords] } : {}),
      } } : {}),
    }));
    return { items, hasMore: start + input.perPage < matched.length };
  }
}

export const apolloMock = new ApolloMock();
