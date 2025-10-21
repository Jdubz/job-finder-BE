/**
 * Type definitions for the AI Resume Generator
 *
 * This file contains all TypeScript interfaces for:
 * - Generator defaults (personal settings)
 * - Generation requests
 * - Generation responses
 * - OpenAI structured outputs (resume and cover letter content)
 */

import { Timestamp } from "@google-cloud/firestore"
import type { ExperienceEntry } from "../services/experience.service"
import type { BlurbEntry } from "../services/blurb.service"

// =============================================================================
// Logging
// =============================================================================

export interface SimpleLogger {
  info: (message: string, data?: unknown) => void
  warning: (message: string, data?: unknown) => void
  error: (message: string, data?: unknown) => void
}

// =============================================================================
// Generation Type
// =============================================================================

export type GenerationType = "resume" | "coverLetter" | "both"

// =============================================================================
// AI Provider Types
// =============================================================================

/**
 * AI Provider Type (for selecting between OpenAI, Gemini, etc.)
 */
export type AIProviderType = "openai" | "gemini"

/**
 * Token usage for AI generation
 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * Result from AI resume generation
 */
export interface AIResumeGenerationResult {
  content: ResumeContent
  tokenUsage: TokenUsage
  model: string
}

/**
 * Result from AI cover letter generation
 */
export interface AICoverLetterGenerationResult {
  content: CoverLetterContent
  tokenUsage: TokenUsage
  model: string
}

/**
 * Job Match Data for AI prompt customization
 */
export interface JobMatchData {
  matchScore?: number
  matchedSkills?: string[]
  missingSkills?: string[]
  keyStrengths?: string[]
  potentialConcerns?: string[]
  keywords?: string[]
  customizationRecommendations?: {
    skills_to_emphasize?: string[]
    resume_focus?: string[]
    cover_letter_points?: string[]
  }
  resumeIntakeData?: {
    target_summary?: string
    skills_priority?: string[]
    keywords_to_include?: string[]
    achievement_angles?: string[]
  }
}

/**
 * Options for generating a resume with AI
 */
export interface GenerateResumeOptions {
  personalInfo: {
    name: string
    email: string
    phone?: string
    location?: string
    website?: string
    github?: string
    linkedin?: string
  }
  job: {
    role: string
    company: string
    companyWebsite?: string
    jobDescription?: string
  }
  experienceEntries: ExperienceEntry[]
  experienceBlurbs: BlurbEntry[]
  emphasize?: string[]
  jobMatchData?: JobMatchData // AI-generated insights for this specific job match
  customPrompts?: {
    systemPrompt?: string
    userPromptTemplate?: string
  }
}

/**
 * Options for generating a cover letter with AI
 */
export interface GenerateCoverLetterOptions {
  personalInfo: {
    name: string
    email: string
  }
  job: {
    role: string
    company: string
    companyWebsite?: string
    jobDescription?: string
  }
  experienceEntries: ExperienceEntry[]
  experienceBlurbs: BlurbEntry[]
  jobMatchData?: JobMatchData // AI-generated insights for this specific job match
  customPrompts?: {
    systemPrompt?: string
    userPromptTemplate?: string
  }
}

/**
 * AI Provider Interface
 *
 * Abstracts the AI provider (OpenAI, Gemini, etc.) to enable:
 * - Cost optimization (switch to cheaper provider)
 * - Vendor flexibility (not locked to single provider)
 * - Quality comparison (A/B test providers)
 * - Fallback options (if one provider has issues)
 */
export interface AIProvider {
  /**
   * Generate resume content using AI
   */
  generateResume(options: GenerateResumeOptions): Promise<AIResumeGenerationResult>

  /**
   * Generate cover letter content using AI
   */
  generateCoverLetter(options: GenerateCoverLetterOptions): Promise<AICoverLetterGenerationResult>

  /**
   * Calculate cost in USD from token usage
   */
  calculateCost(tokenUsage: TokenUsage): number

  /**
   * Get the model name/identifier
   */
  readonly model: string

  /**
   * Get the provider type
   */
  readonly providerType: AIProviderType

  /**
   * Get pricing information (per 1M tokens)
   */
  readonly pricing: {
    inputCostPer1M: number
    outputCostPer1M: number
  }
}

// =============================================================================
// Personal Info (Personal Information Document)
// =============================================================================

export interface PersonalInfo {
  // Document identification
  id: "personal-info"
  type: "personal-info"

  // Personal Information (name and email required, others optional)
  name: string
  email: string
  phone?: string
  location?: string

  // Online Presence
  website?: string
  github?: string
  linkedin?: string

  // Visual Branding
  avatar?: string // URL or GCS path to profile photo
  logo?: string // URL or GCS path to personal logo
  accentColor: string // Hex color for resume styling (always "modern" style)

  // AI Prompts
  aiPrompts?: {
    resume: {
      systemPrompt: string
      userPromptTemplate: string
    }
    coverLetter: {
      systemPrompt: string
      userPromptTemplate: string
    }
  }

  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  updatedBy?: string // Email of last editor
}

export interface UpdatePersonalInfoData {
  name?: string
  email?: string
  phone?: string
  location?: string
  website?: string
  github?: string
  linkedin?: string
  avatar?: string
  logo?: string
  accentColor?: string
  aiPrompts?: {
    resume?: {
      systemPrompt?: string
      userPromptTemplate?: string
    }
    coverLetter?: {
      systemPrompt?: string
      userPromptTemplate?: string
    }
  }
}

// Deprecated type aliases for backward compatibility during migration
/** @deprecated Use PersonalInfo instead */
export type GeneratorDefaults = PersonalInfo
/** @deprecated Use UpdatePersonalInfoData instead */
export type UpdateGeneratorDefaultsData = UpdatePersonalInfoData

// =============================================================================
// Generation Progress Steps
// =============================================================================

export type GenerationStepStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped"

export interface GenerationStep {
  id: string // Unique step identifier
  name: string // Display name for the step
  description: string // Detailed description
  status: GenerationStepStatus
  startedAt?: Timestamp
  completedAt?: Timestamp
  duration?: number // milliseconds

  // Optional result data (e.g., PDF URL when that step completes)
  result?: {
    resumeUrl?: string
    coverLetterUrl?: string
    [key: string]: unknown
  }

  // Error info if failed
  error?: {
    message: string
    code?: string
  }
}

// =============================================================================
// Generator Request (Generation Request Document)
// =============================================================================

export interface GeneratorRequest {
  // Document identification
  id: string // "resume-generator-request-{timestamp}-{randomId}"
  type: "request"

  // Generation Options (same for editors and viewers)
  generateType: GenerationType

  // AI Provider Selection
  provider: AIProviderType // Which AI service to use (openai or gemini)

  // Snapshot of personal info at request time
  personalInfo: {
    name: string
    email: string
    phone?: string
    location?: string
    website?: string
    github?: string
    linkedin?: string
    avatar?: string
    logo?: string
    accentColor: string
  }

  // Job Application Details
  job: {
    role: string // Required
    company: string // Required
    companyWebsite?: string
    jobDescriptionUrl?: string
    jobDescriptionText?: string
  }

  // Job Match Reference (for tracking which job-match this generation is for)
  jobMatchId?: string

  // Generation Preferences
  preferences?: {
    emphasize?: string[] // Keywords to emphasize
  }

  // Experience Data Snapshot
  experienceData: {
    entries: ExperienceEntry[]
    blurbs: BlurbEntry[]
  }

  // Request Status
  status: "pending" | "processing" | "completed" | "failed"

  // Step-by-step Progress Tracking
  steps?: GenerationStep[]

  // Intermediate Results (stored after each step for retry capability)
  intermediateResults?: {
    // AI-generated content (from generate_resume / generate_cover_letter steps)
    resumeContent?: ResumeContent
    coverLetterContent?: CoverLetterContent

    // Token usage tracking
    resumeTokenUsage?: TokenUsage
    coverLetterTokenUsage?: TokenUsage

    // Model used for generation
    model?: string
  }

  // Access Control
  access: {
    viewerSessionId?: string // For public users to retrieve their own docs
    isPublic: boolean // true for viewers, false for editors
  }

  // Timestamps & Metadata
  createdAt: Timestamp
  createdBy: string | null // Email if editor, null if anonymous viewer
}

export interface CreateGeneratorRequestData {
  generateType: GenerationType
  provider?: AIProviderType // Optional, defaults to 'gemini' if not provided
  job: {
    role: string
    company: string
    companyWebsite?: string
    jobDescriptionUrl?: string
    jobDescriptionText?: string
  }
  preferences?: {
    style?: string
    emphasize?: string[]
  }
}

// =============================================================================
// Generator Response (Generation Response Document)
// =============================================================================

export interface GeneratorResponse {
  // Document identification
  id: string // "resume-generator-response-{timestamp}-{randomId}" (matches request)
  type: "response"

  // Reference to request document
  requestId: string

  // Generation Results
  result: {
    success: boolean

    // Generated Content (OpenAI structured outputs)
    resume?: ResumeContent
    coverLetter?: CoverLetterContent

    // Error Information (if failed)
    error?: {
      message: string
      code?: string
      stage?:
        | "fetch_defaults"
        | "fetch_experience"
        | "openai_resume"
        | "openai_cover_letter"
        | "openai_generation"
        | "gemini_generation"
        | "pdf_generation"
        | "gcs_upload"
      details?: unknown
    }
  }

  // Generated Files in GCS (Phase 2)
  files?: {
    resume?: {
      gcsPath: string
      signedUrl?: string
      signedUrlExpiry?: Timestamp
      size?: number
      storageClass?: "STANDARD" | "COLDLINE"
    }
    coverLetter?: {
      gcsPath: string
      signedUrl?: string
      signedUrlExpiry?: Timestamp
      size?: number
      storageClass?: "STANDARD" | "COLDLINE"
    }
  }

  // Performance Metrics
  metrics: {
    durationMs: number

    // Token usage (if OpenAI was called)
    tokenUsage?: {
      resumePrompt?: number
      resumeCompletion?: number
      coverLetterPrompt?: number
      coverLetterCompletion?: number
      total: number
    }

    // Cost calculation
    costUsd?: number

    // Model information
    model: string
  }

  // Timestamps
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// =============================================================================
// OpenAI Structured Output Types
// =============================================================================

/**
 * Resume Content (OpenAI structured output)
 */
export interface ResumeContent {
  personalInfo: {
    name: string
    title: string
    summary: string
    contact: {
      email: string
      location?: string
      website?: string
      linkedin?: string
      github?: string
    }
  }
  professionalSummary: string
  experience: Array<{
    company: string
    role: string
    location?: string
    startDate: string
    endDate: string | null
    highlights: string[]
    technologies?: string[]
  }>
  skills?: Array<{
    category: string
    items: string[]
  }>
  education?: Array<{
    institution: string
    degree: string
    field?: string
    startDate?: string
    endDate?: string
  }>
}

/**
 * Cover Letter Content (OpenAI structured output)
 */
export interface CoverLetterContent {
  greeting: string
  openingParagraph: string
  bodyParagraphs: string[]
  closingParagraph: string
  signature: string
}

// =============================================================================
// Helper Types for API Requests/Responses
// =============================================================================

/**
 * Request payload for document generation (from frontend)
 */
export interface GenerateDocumentsRequest {
  generateType: GenerationType
  provider?: AIProviderType // Optional, defaults to 'gemini' if not provided
  job: {
    role: string
    company: string
    companyWebsite?: string
    jobDescriptionUrl?: string
    jobDescriptionText?: string
  }
  preferences?: {
    style?: string
    emphasize?: string[]
  }
}

/**
 * Response payload for document generation (to frontend)
 */
export interface GenerateDocumentsResponse {
  requestId: string
  responseId: string
  success: boolean

  // Download URLs (Phase 2 - for now return PDFs directly)
  resumeUrl?: string
  coverLetterUrl?: string

  // Metadata
  metadata: {
    generatedAt: string
    role: string
    company: string
    generateType: GenerationType
    tokenUsage?: {
      total: number
    }
    costUsd?: number
    model: string
    durationMs: number
  }

  // Error (if failed)
  error?: {
    message: string
    code?: string
    stage?: string
  }
}
