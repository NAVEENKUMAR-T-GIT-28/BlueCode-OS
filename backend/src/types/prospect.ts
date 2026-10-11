export type ProspectStatus = 'discovered' | 'qualified' | 'disqualified' | 'do_not_contact';
export type ScoreCategory = 'hot' | 'high' | 'medium' | 'low';
export type ProspectListQuery = {
  icpId?: string;
  scoredAgainstIcpId?: string;
  status?: ProspectStatus;
  category?: ScoreCategory[];
  minScore?: number;
  q?: string;
  includeLow: boolean;
  sort: 'score' | '-score' | 'createdAt' | '-createdAt' | 'name';
  page: number;
  limit: number;
};
