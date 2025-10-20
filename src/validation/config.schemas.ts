/**
 * Validation schemas for configuration management
 */

import Joi from "joi";

/**
 * Validation schema for stop list configuration
 */
export const stopListSchema = Joi.object({
  excludedCompanies: Joi.array()
    .items(Joi.string().trim().max(200))
    .max(1000)
    .optional()
    .default([]),
  excludedKeywords: Joi.array()
    .items(Joi.string().trim().max(200))
    .max(1000)
    .optional()
    .default([]),
  excludedDomains: Joi.array()
    .items(Joi.string().trim().max(200))
    .max(1000)
    .optional()
    .default([]),
});

/**
 * Validation schema for AI settings configuration
 */
export const aiSettingsSchema = Joi.object({
  provider: Joi.string().valid("claude", "openai", "gemini").required(),
  model: Joi.string().trim().min(1).max(100).required(),
  minMatchScore: Joi.number().integer().min(0).max(100).required(),
  costBudgetDaily: Joi.number().min(0).required(),
});

/**
 * Validation schema for queue settings configuration
 */
export const queueSettingsSchema = Joi.object({
  maxRetries: Joi.number().integer().min(1).max(10).required(),
  retryDelaySeconds: Joi.number().integer().min(0).required(),
  processingTimeout: Joi.number().integer().min(60).required(),
});

/**
 * Validation schema for check stop list request
 */
export const checkStopListSchema = Joi.object({
  companyName: Joi.string().trim().min(1).max(200).required(),
  url: Joi.string().uri().trim().required(),
});
