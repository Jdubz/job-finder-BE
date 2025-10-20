import { SecretManagerServiceClient } from "@google-cloud/secret-manager"
import { createDefaultLogger } from "../utils/logger"
import type { SimpleLogger } from "../types/logger.types"

/**
 * Secret Manager service for job-finder
 * Manages retrieval of secrets from Google Cloud Secret Manager
 */
export class SecretManagerService {
  private client: SecretManagerServiceClient
  private projectId: string
  private logger: SimpleLogger
  private secretCache: Map<string, { value: string; timestamp: number }>

  constructor(projectId?: string) {
    this.client = new SecretManagerServiceClient()
    this.projectId = projectId ?? process.env.GCP_PROJECT ?? "static-sites-257923"
    this.secretCache = new Map()

    // Use shared logger factory
    this.logger = createDefaultLogger()
  }

  /**
   * Get a secret value from Google Secret Manager
   * Caches secrets for 5 minutes to reduce API calls
   */
  async getSecret(secretName: string, useCache = true): Promise<string> {
    // Check cache first (5 minute TTL)
    if (useCache) {
      const cached = this.secretCache.get(secretName)
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.value
      }
    }

    try {
      const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`
      const [version] = await this.client.accessSecretVersion({ name })

      if (!version.payload?.data) {
        throw new Error(`Secret ${secretName} has no data`)
      }

      const value = version.payload.data.toString()

      // Cache the secret
      this.secretCache.set(secretName, {
        value,
        timestamp: Date.now(),
      })

      return value
    } catch (error) {
      this.logger.error(`Failed to get secret ${secretName}`, { error })
      throw new Error(`Failed to retrieve secret: ${secretName}`)
    }
  }

  /**
   * Get multiple secrets at once
   */
  async getSecrets(secretNames: string[]): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {}

    const promises = secretNames.map(async (secretName) => {
      try {
        secrets[secretName] = await this.getSecret(secretName)
      } catch (error) {
        this.logger.warning(`Failed to get secret: ${secretName}`, { error })
        // Continue with other secrets even if one fails
      }
    })

    await Promise.all(promises)
    return secrets
  }

  /**
   * Clear the secret cache
   * Useful for testing or when secrets are rotated
   */
  clearCache(): void {
    this.secretCache.clear()
    this.logger.info("Secret cache cleared")
  }

  /**
   * Check if running in local development environment
   */
  isLocalDevelopment(): boolean {
    return (
      process.env.NODE_ENV === "development" || process.env.FUNCTIONS_EMULATOR === "true" || !process.env.GCP_PROJECT
    )
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(): {
    isProduction: boolean
    isStaging: boolean
    isDevelopment: boolean
    projectId: string
  } {
    const isDevelopment = this.isLocalDevelopment()
    const isStaging = process.env.ENVIRONMENT === "staging"
    const isProduction = !isDevelopment && !isStaging

    return {
      isDevelopment,
      isStaging,
      isProduction,
      projectId: this.projectId,
    }
  }
}

/**
 * Helper function to get a Secret Manager service instance
 */
export function createSecretManagerService(projectId?: string): SecretManagerService {
  return new SecretManagerService(projectId)
}
