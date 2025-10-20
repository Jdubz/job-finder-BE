/**
 * Configuration Service
 *
 * Handles business logic for managing system configuration including
 * stop lists, AI settings, and queue settings.
 */

import { Firestore } from "@google-cloud/firestore";
import { createFirestoreInstance } from "../config/firestore";
import type { SimpleLogger } from "../types/logger.types";
import { createDefaultLogger } from "../utils/logger";
import type {
  StopListConfig,
  AISettings,
  QueueSettings,
  CheckStopListResponse,
} from "../types/config.types";

/**
 * Configuration collection name in Firestore
 */
const CONFIG_COLLECTION = "job-finder-config";

/**
 * Default configuration values
 */
const DEFAULT_STOP_LIST: StopListConfig = {
  excludedCompanies: [],
  excludedKeywords: [],
  excludedDomains: [],
};

const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "claude",
  model: "claude-3-5-sonnet-20241022",
  minMatchScore: 70,
  costBudgetDaily: 10.0,
};

const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  maxRetries: 3,
  retryDelaySeconds: 300,
  processingTimeout: 3600,
};

/**
 * ConfigService - Manages system configuration
 */
export class ConfigService {
  private db: Firestore;
  private logger: SimpleLogger;

  constructor(logger?: SimpleLogger) {
    this.db = createFirestoreInstance();
    this.logger = logger || createDefaultLogger();
  }

  /**
   * Get stop list configuration
   */
  async getStopList(): Promise<StopListConfig> {
    try {
      const doc = await this.db
        .collection(CONFIG_COLLECTION)
        .doc("stop-list")
        .get();

      if (!doc.exists) {
        this.logger.info("Stop list not found, returning defaults");
        return DEFAULT_STOP_LIST;
      }

      return doc.data() as StopListConfig;
    } catch (error) {
      this.logger.error("Failed to get stop list", { error });
      throw new Error("Failed to retrieve stop list configuration");
    }
  }

  /**
   * Update stop list configuration
   */
  async updateStopList(
    stopList: Partial<StopListConfig>,
    updatedBy: string
  ): Promise<void> {
    try {
      const updateData: Partial<StopListConfig> = {
        ...stopList,
        updatedAt: new Date().toISOString(),
        updatedBy,
      };

      await this.db
        .collection(CONFIG_COLLECTION)
        .doc("stop-list")
        .set(updateData, { merge: true });

      this.logger.info("Stop list updated", {
        updatedBy,
        excludedCompanies: stopList.excludedCompanies?.length,
        excludedKeywords: stopList.excludedKeywords?.length,
        excludedDomains: stopList.excludedDomains?.length,
      });
    } catch (error) {
      this.logger.error("Failed to update stop list", { error, updatedBy });
      throw new Error("Failed to update stop list configuration");
    }
  }

  /**
   * Check if a job/company would be blocked by stop list
   */
  async checkStopList(
    companyName: string,
    url: string
  ): Promise<CheckStopListResponse> {
    try {
      const stopList = await this.getStopList();

      // Extract domain from URL
      let domain: string;
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname.replace(/^www\./, "").toLowerCase();
      } catch (error) {
        this.logger.warning("Invalid URL format", { url });
        return { isExcluded: false, reason: null };
      }

      // Check domain
      if (
        stopList.excludedDomains?.some(
          (d) => d.toLowerCase() === domain
        )
      ) {
        return { isExcluded: true, reason: "domain" };
      }

      // Check company name (case-insensitive exact match)
      const lowerCompanyName = companyName.toLowerCase().trim();
      if (
        stopList.excludedCompanies?.some(
          (c) => c.toLowerCase().trim() === lowerCompanyName
        )
      ) {
        return { isExcluded: true, reason: "company" };
      }

      // Check keywords (case-insensitive substring match)
      for (const keyword of stopList.excludedKeywords || []) {
        if (lowerCompanyName.includes(keyword.toLowerCase().trim())) {
          return { isExcluded: true, reason: "keyword" };
        }
      }

      return { isExcluded: false, reason: null };
    } catch (error) {
      this.logger.error("Failed to check stop list", {
        error,
        companyName,
        url,
      });
      // On error, fail open (don't block)
      return { isExcluded: false, reason: null };
    }
  }

  /**
   * Get AI settings configuration
   */
  async getAISettings(): Promise<AISettings> {
    try {
      const doc = await this.db
        .collection(CONFIG_COLLECTION)
        .doc("ai-settings")
        .get();

      if (!doc.exists) {
        this.logger.info("AI settings not found, returning defaults");
        return DEFAULT_AI_SETTINGS;
      }

      return doc.data() as AISettings;
    } catch (error) {
      this.logger.error("Failed to get AI settings", { error });
      throw new Error("Failed to retrieve AI settings configuration");
    }
  }

  /**
   * Update AI settings configuration
   */
  async updateAISettings(
    settings: Partial<AISettings>,
    updatedBy: string
  ): Promise<void> {
    try {
      const updateData: Partial<AISettings> = {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy,
      };

      await this.db
        .collection(CONFIG_COLLECTION)
        .doc("ai-settings")
        .set(updateData, { merge: true });

      this.logger.info("AI settings updated", {
        updatedBy,
        provider: settings.provider,
        model: settings.model,
      });
    } catch (error) {
      this.logger.error("Failed to update AI settings", { error, updatedBy });
      throw new Error("Failed to update AI settings configuration");
    }
  }

  /**
   * Get queue settings configuration
   */
  async getQueueSettings(): Promise<QueueSettings> {
    try {
      const doc = await this.db
        .collection(CONFIG_COLLECTION)
        .doc("queue-settings")
        .get();

      if (!doc.exists) {
        this.logger.info("Queue settings not found, returning defaults");
        return DEFAULT_QUEUE_SETTINGS;
      }

      return doc.data() as QueueSettings;
    } catch (error) {
      this.logger.error("Failed to get queue settings", { error });
      throw new Error("Failed to retrieve queue settings configuration");
    }
  }

  /**
   * Update queue settings configuration
   */
  async updateQueueSettings(
    settings: Partial<QueueSettings>,
    updatedBy: string
  ): Promise<void> {
    try {
      const updateData: Partial<QueueSettings> = {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy,
      };

      await this.db
        .collection(CONFIG_COLLECTION)
        .doc("queue-settings")
        .set(updateData, { merge: true });

      this.logger.info("Queue settings updated", {
        updatedBy,
        maxRetries: settings.maxRetries,
        retryDelaySeconds: settings.retryDelaySeconds,
      });
    } catch (error) {
      this.logger.error("Failed to update queue settings", {
        error,
        updatedBy,
      });
      throw new Error("Failed to update queue settings configuration");
    }
  }
}
