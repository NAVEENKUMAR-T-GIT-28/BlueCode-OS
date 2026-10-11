import { describe, expect, it } from 'vitest';
import { ApolloMock } from '../src/providers/apollo/apollo-mock.js';

describe('ApolloMock', () => {
  it('returns only clearly synthetic fixture records and supports pagination', async () => {
    const provider = new ApolloMock();
    const first = await provider.searchOrganizations({ criteria: {}, page: 1, perPage: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    expect(first.items.every(item => item.name.startsWith('Mock ') && item.domain?.endsWith('.example'))).toBe(true);
  });

  it('filters by ICP industry and country criteria', async () => {
    const provider = new ApolloMock();
    const result = await provider.searchOrganizations({
      criteria: { industries: ['Human Resources Software'], countries: ['United Kingdom'] },
      page: 1, perPage: 25,
    });
    expect(result.items.map(item => item.apolloOrganizationId)).toEqual(['mock-org-hr-001']);
    expect(result.hasMore).toBe(false);
  });

  it('applies employee range and exclusion criteria without external I/O', async () => {
    const provider = new ApolloMock();
    const result = await provider.searchOrganizations({
      criteria: { industries: ['Human Resources Software'], employeeRanges: ['100-200'], excludedIndustries: ['Human Resources'] },
      page: 1, perPage: 25,
    });
    expect(result.items).toEqual([]);
  });
});
