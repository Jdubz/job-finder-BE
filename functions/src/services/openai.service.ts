/**
 * OpenAI Service
 *
 * Handles all OpenAI API interactions for resume and cover letter generation.
 * Uses GPT-4o with structured outputs for consistent, type-safe responses.
 *
 * Cost: $2.50 input / $10.00 output per 1M tokens
 * Model: gpt-4o-2024-08-06
 */

import OpenAI from "openai"
import type { SimpleLogger } from "../types/logger.types"
import { createDefaultLogger } from "../utils/logger"
import type {
  TokenUsage,
  ResumeContent,
  CoverLetterContent,
  ExperienceEntry,
  JobMatchData,
  PersonalInfo,
  JobInfo,
} from "@jsdubzw/job-finder-shared-types"

/**
 * Options for generating a resume with AI
 */
export interface GenerateResumeOptions {
  personalInfo: PersonalInfo
  job: JobInfo
  experienceEntries: ExperienceEntry[]
  emphasize?: string[]
  jobMatchData?: JobMatchData
  customPrompts?: {
    systemPrompt?: string
    userPromptTemplate?: string
  }
}

/**
 * Options for generating a cover letter with AI
 */
export interface GenerateCoverLetterOptions {
  personalInfo: Pick<PersonalInfo, "name" | "email">
  job: JobInfo
  experienceEntries: ExperienceEntry[]
  jobMatchData?: JobMatchData
  customPrompts?: {
    systemPrompt?: string
    userPromptTemplate?: string
  }
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

export class OpenAIService {
  private client: OpenAI
  private logger: SimpleLogger
  private useMockMode: boolean

  readonly model: string = "gpt-4o-2024-08-06"
  readonly providerType = "openai" as const
  readonly pricing = {
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
  }

  constructor(apiKey: string, logger?: SimpleLogger) {
    this.client = new OpenAI({ apiKey })
    this.logger = logger || createDefaultLogger()

    // Use mock mode in test/development to avoid API costs
    this.useMockMode =
      process.env.NODE_ENV === "test" ||
      process.env.USE_MOCK_AI === "true" ||
      process.env.FUNCTIONS_EMULATOR === "true"

    if (this.useMockMode) {
      this.logger.warning("[OpenAI] Running in MOCK MODE - not calling OpenAI API")
    }
  }

  /**
   * Generate a resume using OpenAI structured outputs
   */
  async generateResume(options: GenerateResumeOptions): Promise<AIResumeGenerationResult> {
    if (this.useMockMode) {
      return this.generateMockResume(options)
    }

    try {
      const systemPrompt = options.customPrompts?.systemPrompt || this.buildResumeSystemPrompt()
      const userPrompt = options.customPrompts?.userPromptTemplate
        ? this.interpolateUserPrompt(options.customPrompts.userPromptTemplate, options)
        : this.buildResumeUserPrompt(options)

      this.logger.info("Generating resume with OpenAI", {
        model: this.model,
        role: options.job.role,
        company: options.job.company,
        experienceCount: options.experienceEntries.length,
      })

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent, factual output
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "resume_content",
            strict: true,
            schema: this.getResumeSchema(),
          },
        },
      })

      const content = JSON.parse(completion.choices[0].message.content || "{}")

      const tokenUsage: TokenUsage = {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      }

      this.logger.info("Resume generated successfully", {
        model: completion.model,
        tokenUsage,
      })

      return {
        content,
        tokenUsage,
        model: completion.model,
      }
    } catch (error) {
      this.logger.error("Failed to generate resume", { error })
      throw new Error(
        `OpenAI resume generation failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Generate a cover letter using OpenAI structured outputs
   */
  async generateCoverLetter(
    options: GenerateCoverLetterOptions
  ): Promise<AICoverLetterGenerationResult> {
    if (this.useMockMode) {
      return this.generateMockCoverLetter(options)
    }

    try {
      const systemPrompt = options.customPrompts?.systemPrompt || this.buildCoverLetterSystemPrompt()
      const userPrompt = options.customPrompts?.userPromptTemplate
        ? this.interpolateCoverLetterPrompt(options.customPrompts.userPromptTemplate, options)
        : this.buildCoverLetterUserPrompt(options)

      this.logger.info("Generating cover letter with OpenAI", {
        model: this.model,
        role: options.job.role,
        company: options.job.company,
      })

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "cover_letter_content",
            strict: true,
            schema: this.getCoverLetterSchema(),
          },
        },
      })

      const content = JSON.parse(completion.choices[0].message.content || "{}")

      const tokenUsage: TokenUsage = {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      }

      this.logger.info("Cover letter generated successfully", {
        model: completion.model,
        tokenUsage,
      })

      return {
        content,
        tokenUsage,
        model: completion.model,
      }
    } catch (error) {
      this.logger.error("Failed to generate cover letter", { error })
      throw new Error(
        `OpenAI cover letter generation failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Calculate cost in USD from token usage
   * Based on GPT-4o pricing: $2.50/1M input tokens, $10.00/1M output tokens
   */
  calculateCost(tokenUsage: TokenUsage): number {
    const inputCost = (tokenUsage.promptTokens / 1_000_000) * this.pricing.inputCostPer1M
    const outputCost = (tokenUsage.completionTokens / 1_000_000) * this.pricing.outputCostPer1M
    return inputCost + outputCost
  }

  /**
   * Build system prompt for resume generation
   */
  private buildResumeSystemPrompt(): string {
    return `You are a professional resume formatter with strict adherence to factual accuracy and conciseness.

CRITICAL RULES - THESE ARE ABSOLUTE AND NON-NEGOTIABLE:
1. ONLY use information explicitly provided in the experience data
2. NEVER add metrics, numbers, percentages, or statistics not in the original data
3. NEVER invent job responsibilities, accomplishments, or technologies
4. NEVER create companies, roles, dates, or locations not provided
5. If information is missing or unclear, omit it entirely - DO NOT guess or infer
6. You may REFORMAT wording for clarity, but NEVER change factual content
7. You may REORGANIZE content for better presentation, but NEVER add new information

LENGTH REQUIREMENTS (STRICT):
- MAXIMUM: 1-2 pages when rendered to PDF (600-750 words total)
- Include ONLY 3-4 most relevant experience entries (prioritize relevance over completeness)
- MAXIMUM 4 bullet points per experience entry
- Professional summary: 2-3 sentences maximum (50-75 words)
- Prioritize QUALITY over QUANTITY - better to have fewer, stronger highlights

Your role is to:
- SELECT the 3-4 most relevant experiences for the target role
- Format and structure ONLY the most relevant experience professionally
- Emphasize relevance through SELECTION and ORDERING, not fabrication
- Write CONCISE, impactful bullet points (1-2 lines each maximum)
- Improve phrasing and grammar while preserving all factual details
- Ensure ATS-friendliness through proper formatting
- Use action verbs from the source material
- Focus on impact and results that are stated in the data

SELECTION PRIORITY:
- Relevance to target role is MORE important than recency
- Quality of accomplishments is MORE important than quantity
- If an experience has weak or generic content, SKIP IT entirely
- Better to have 3 strong entries than 5 mediocre ones

What you CANNOT do:
- Include more than 4 experience entries
- Include more than 4 bullet points per entry
- Add accomplishments not stated in the source data
- Insert metrics or quantification not explicitly provided
- Infer skills, technologies, or methodologies not mentioned
- Create education entries if none are provided
- Write verbose or lengthy descriptions`
  }

  /**
   * Build user prompt for resume generation
   */
  private buildResumeUserPrompt(options: GenerateResumeOptions): string {
    // Format experience data
    const experienceData = options.experienceEntries
      .map((exp, index) => {
        const highlights = exp.highlights?.join("\n- ") || "No highlights provided"
        const technologies = exp.technologies?.length
          ? `\nTechnologies: ${exp.technologies.join(", ")}`
          : ""

        return `
=== EXPERIENCE ${index + 1} ===
Company: ${exp.company}
Role: ${exp.role}
Location: ${exp.location || "Not specified"}
Duration: ${exp.startDate} to ${exp.endDate || "Present"}
Highlights:
- ${highlights}${technologies}
=== END EXPERIENCE ${index + 1} ===`
      })
      .join("\n\n")

    const emphasisSection = options.emphasize?.length
      ? `\n\nEMPHASIZE THESE AREAS: ${options.emphasize.join(", ")}`
      : ""

    const jobMatchSection = options.jobMatchData
      ? `\n\nJOB MATCH DATA:
${options.jobMatchData.matchScore ? `Match Score: ${options.jobMatchData.matchScore}%` : ""}
${options.jobMatchData.matchedSkills?.length ? `Matched Skills: ${options.jobMatchData.matchedSkills.join(", ")}` : ""}
${options.jobMatchData.missingSkills?.length ? `Skills to Develop: ${options.jobMatchData.missingSkills.join(", ")}` : ""}
${options.jobMatchData.keyStrengths?.length ? `Key Strengths: ${options.jobMatchData.keyStrengths.join(", ")}` : ""}`
      : ""

    return `Create a tailored resume for the following position:

TARGET POSITION:
Role: ${options.job.role}
Company: ${options.job.company}
${options.job.jobDescriptionText ? `Job Description:\n${options.job.jobDescriptionText.substring(0, 2000)}` : ""}

CANDIDATE INFORMATION:
Name: ${options.personalInfo.name}
Email: ${options.personalInfo.email}
${options.personalInfo.phone ? `Phone: ${options.personalInfo.phone}` : ""}
${options.personalInfo.location ? `Location: ${options.personalInfo.location}` : ""}
${options.personalInfo.website ? `Website: ${options.personalInfo.website}` : ""}
${options.personalInfo.linkedin ? `LinkedIn: ${options.personalInfo.linkedin}` : ""}
${options.personalInfo.github ? `GitHub: ${options.personalInfo.github}` : ""}

EXPERIENCE DATA:
${experienceData}${emphasisSection}${jobMatchSection}

Instructions:
1. Select the 3-4 MOST RELEVANT experiences for this ${options.job.role} role
2. Write a professional summary (2-3 sentences) highlighting fit for the role
3. Format each experience with maximum 4 impactful bullet points
4. Extract and categorize skills from the experiences
5. Order experiences by RELEVANCE to the target role, not chronologically
6. Ensure ATS-friendly formatting with proper keywords from the job description`
  }

  /**
   * Build system prompt for cover letter generation
   */
  private buildCoverLetterSystemPrompt(): string {
    return `You are a professional cover letter writer specializing in creating compelling, personalized application letters.

CRITICAL RULES:
1. ONLY use information explicitly provided in the experience data
2. NEVER fabricate accomplishments, metrics, or experiences
3. Write in a professional but authentic tone
4. Keep it concise - 3-4 paragraphs maximum
5. Focus on WHY the candidate is a good fit, not just WHAT they did
6. Draw clear connections between experience and job requirements
7. Show enthusiasm without being overly casual

Structure:
- Greeting: Professional salutation (use hiring manager name if provided)
- Opening: Strong hook that shows interest and fit
- Body (2-3 paragraphs): Highlight relevant experiences and skills
- Closing: Call to action and professional sign-off

Tone: Professional, confident, enthusiastic, authentic`
  }

  /**
   * Build user prompt for cover letter generation
   */
  private buildCoverLetterUserPrompt(options: GenerateCoverLetterOptions): string {
    const experienceData = options.experienceEntries
      .map((exp, index) => {
        const highlights = exp.highlights?.join("\n- ") || "No highlights provided"
        return `
Experience ${index + 1}:
${exp.role} at ${exp.company} (${exp.startDate} to ${exp.endDate || "Present"})
- ${highlights}`
      })
      .join("\n\n")

    const jobMatchSection = options.jobMatchData
      ? `\n\nJOB MATCH INSIGHTS:
${options.jobMatchData.keyStrengths?.length ? `Your Strengths: ${options.jobMatchData.keyStrengths.join(", ")}` : ""}
${options.jobMatchData.matchedSkills?.length ? `Relevant Skills: ${options.jobMatchData.matchedSkills.join(", ")}` : ""}`
      : ""

    return `Create a compelling cover letter for the following position:

TARGET POSITION:
Role: ${options.job.role}
Company: ${options.job.company}
${options.job.jobDescriptionText ? `Job Description:\n${options.job.jobDescriptionText.substring(0, 1500)}` : ""}

CANDIDATE:
Name: ${options.personalInfo.name}
Email: ${options.personalInfo.email}

RELEVANT EXPERIENCE:
${experienceData}${jobMatchSection}

Create a cover letter that:
1. Opens with a strong statement about why you're interested in this role
2. Highlights 2-3 most relevant experiences that demonstrate fit
3. Shows enthusiasm for the company and role
4. Closes with a confident call to action
5. Keeps total length to 300-400 words`
  }

  /**
   * Get JSON schema for resume structured output
   */
  private getResumeSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        personalInfo: {
          type: "object",
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            contact: {
              type: "object",
              properties: {
                email: { type: "string" },
                location: { type: "string" },
                website: { type: "string" },
                linkedin: { type: "string" },
                github: { type: "string" },
              },
              required: ["email"],
              additionalProperties: false,
            },
          },
          required: ["name", "title", "summary", "contact"],
          additionalProperties: false,
        },
        professionalSummary: { type: "string" },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              role: { type: "string" },
              location: { type: "string" },
              startDate: { type: "string" },
              endDate: { type: ["string", "null"] },
              highlights: {
                type: "array",
                items: { type: "string" },
              },
              technologies: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["company", "role", "startDate", "endDate", "highlights"],
            additionalProperties: false,
          },
        },
        skills: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              items: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["category", "items"],
            additionalProperties: false,
          },
        },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              institution: { type: "string" },
              degree: { type: "string" },
              field: { type: "string" },
              startDate: { type: "string" },
              endDate: { type: "string" },
            },
            required: ["institution", "degree"],
            additionalProperties: false,
          },
        },
      },
      required: ["personalInfo", "professionalSummary", "experience"],
      additionalProperties: false,
    }
  }

  /**
   * Get JSON schema for cover letter structured output
   */
  private getCoverLetterSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        greeting: { type: "string" },
        openingParagraph: { type: "string" },
        bodyParagraphs: {
          type: "array",
          items: { type: "string" },
        },
        closingParagraph: { type: "string" },
        signature: { type: "string" },
      },
      required: ["greeting", "openingParagraph", "bodyParagraphs", "closingParagraph", "signature"],
      additionalProperties: false,
    }
  }

  /**
   * Generate a mock resume for local development/testing
   */
  private generateMockResume(options: GenerateResumeOptions): AIResumeGenerationResult {
    this.logger.info("[MOCK] Generating mock resume", {
      role: options.job.role,
      company: options.job.company,
    })

    const content: ResumeContent = {
      personalInfo: {
        name: options.personalInfo.name,
        title: `Senior ${options.job.role}`,
        summary: `Experienced professional seeking ${options.job.role} position at ${options.job.company}.`,
        contact: {
          email: options.personalInfo.email,
          location: options.personalInfo.location,
          website: options.personalInfo.website,
          linkedin: options.personalInfo.linkedin,
          github: options.personalInfo.github,
        },
      },
      professionalSummary: `Mock professional summary for ${options.job.role} at ${options.job.company}.`,
      experience: options.experienceEntries.slice(0, 3).map((exp) => ({
        company: exp.company,
        role: exp.role,
        location: exp.location,
        startDate: exp.startDate,
        endDate: exp.endDate,
        highlights: exp.highlights || ["Mock highlight 1", "Mock highlight 2"],
        technologies: exp.technologies,
      })),
      skills: [
        {
          category: "Programming Languages",
          items: ["JavaScript", "TypeScript", "Python"],
        },
      ],
    }

    return {
      content,
      tokenUsage: {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      },
      model: "gpt-4o-mock",
    }
  }

  /**
   * Generate a mock cover letter for local development/testing
   */
  private generateMockCoverLetter(
    options: GenerateCoverLetterOptions
  ): AICoverLetterGenerationResult {
    this.logger.info("[MOCK] Generating mock cover letter", {
      role: options.job.role,
      company: options.job.company,
    })

    const content: CoverLetterContent = {
      greeting: "Dear Hiring Manager,",
      openingParagraph: `I am writing to express my strong interest in the ${options.job.role} position at ${options.job.company}.`,
      bodyParagraphs: [
        "Mock body paragraph 1 highlighting relevant experience.",
        "Mock body paragraph 2 demonstrating skills and achievements.",
      ],
      closingParagraph: `I am excited about the opportunity to contribute to ${options.job.company} and would welcome the chance to discuss how my experience aligns with your needs.`,
      signature: `Sincerely,\n${options.personalInfo.name}`,
    }

    return {
      content,
      tokenUsage: {
        promptTokens: 800,
        completionTokens: 300,
        totalTokens: 1100,
      },
      model: "gpt-4o-mock",
    }
  }

  /**
   * Interpolate user prompt template with actual values
   */
  private interpolateUserPrompt(template: string, options: GenerateResumeOptions): string {
    return template
      .replace(/\{\{role\}\}/g, options.job.role)
      .replace(/\{\{company\}\}/g, options.job.company)
      .replace(/\{\{name\}\}/g, options.personalInfo.name)
      .replace(/\{\{email\}\}/g, options.personalInfo.email)
  }

  /**
   * Interpolate cover letter prompt template with actual values
   */
  private interpolateCoverLetterPrompt(
    template: string,
    options: GenerateCoverLetterOptions
  ): string {
    return template
      .replace(/\{\{role\}\}/g, options.job.role)
      .replace(/\{\{company\}\}/g, options.job.company)
      .replace(/\{\{name\}\}/g, options.personalInfo.name)
  }
}

/**
 * Helper function to create an OpenAI service instance
 */
export function createOpenAIService(apiKey: string, logger?: SimpleLogger): OpenAIService {
  return new OpenAIService(apiKey, logger)
}
