export interface LlmCompletionRequest {
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  jsonSchema?: unknown;
}

export interface LlmCompletionResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmClient {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

/**
 * Fixture-backed client for local development and automated tests only.
 * It is deliberately not an LLM and its response explicitly identifies itself as a mock.
 */
export class MockLlmClient implements LlmClient {
  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const match = /<untrusted_data source="founder_input">([\s\S]*?)<\/untrusted_data>/.exec(request.user);
    if (!match?.[1]) throw new Error('Mock ICP fixture could not read founder input.');

    // The builder encodes angle brackets as JSON unicode escapes before wrapping input,
    // so user text cannot close the untrusted-data delimiter.
    const input = JSON.parse(match[1]) as {
      productDescription: string;
      targetGeography?: string;
      salesObjective?: string;
      notes?: string;
    };
    const description = input.productDescription.toLocaleLowerCase('en');
    let output: unknown;

    if (/\b(hrms|payroll|human resources? software|human resource management)\b/.test(description)) {
      output = {
        criteria: {
          industries: ['Human Resources Software'],
          targetJobTitles: ['HR Manager', 'Payroll Manager'],
        },
        rationale: 'MOCK-ONLY fixture for local development; this is not a live AI-generated recommendation.',
      };
    } else if (/\b(accounting|bookkeeping|finance software)\b/.test(description)) {
      output = {
        criteria: {
          industries: ['Accounting Software'],
          targetJobTitles: ['Finance Manager', 'Controller'],
        },
        rationale: 'MOCK-ONLY fixture for local development; this is not a live AI-generated recommendation.',
      };
    } else if (/\b(crm|customer relationship management|sales pipeline software)\b/.test(description)) {
      output = {
        criteria: {
          industries: ['CRM Software'],
          targetJobTitles: ['Sales Operations Manager'],
        },
        rationale: 'MOCK-ONLY fixture for local development; this is not a live AI-generated recommendation.',
      };
    } else {
      output = {
        insufficient_data: true,
        missing: ['Add a clear target industry or buyer role so the ICP can be grounded in the product description.'],
      };
    }

    return { text: JSON.stringify(output), usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
