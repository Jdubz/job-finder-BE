/**
 * Type definitions for configuration management
 */

/**
 * Stop List Configuration
 * Defines companies, keywords, and domains to exclude from job matching
 */
export interface StopListConfig {
  excludedCompanies: string[];
  excludedKeywords: string[];
  excludedDomains: string[];
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * AI Settings Configuration
 * Controls AI provider, model selection, and matching behavior
 */
export interface AISettings {
  provider: "claude" | "openai" | "gemini";
  model: string;
  minMatchScore: number;
  costBudgetDaily: number;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Queue Settings Configuration
 * Controls queue processing behavior
 */
export interface QueueSettings {
  maxRetries: number;
  retryDelaySeconds: number;
  processingTimeout: number;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Check Stop List Request
 */
export interface CheckStopListRequest {
  companyName: string;
  url: string;
}

/**
 * Check Stop List Response
 */
export interface CheckStopListResponse {
  isExcluded: boolean;
  reason: "domain" | "company" | "keyword" | null;
}
