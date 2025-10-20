/**
 * PDF Service
 *
 * Handles PDF generation using Puppeteer and Handlebars templates.
 * Generates professional resumes and cover letters from AI-generated content.
 */

import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import Handlebars from "handlebars"
import * as fs from "fs/promises"
import * as path from "path"
import type { SimpleLogger } from "../types/logger.types"
import { createDefaultLogger } from "../utils/logger"
import type { ResumeContent, CoverLetterContent } from "@jsdubzw/job-finder-shared-types"
import { formatMonthYear } from "../utils/date-format"

export class PDFService {
  private logger: SimpleLogger
  private resumeTemplate?: HandlebarsTemplateDelegate
  private coverLetterTemplate?: HandlebarsTemplateDelegate

  constructor(logger?: SimpleLogger) {
    // Use shared logger factory
    this.logger = logger || createDefaultLogger()

    // Register Handlebars helpers
    this.registerHelpers()
  }

  /**
   * Register Handlebars helpers for template rendering
   */
  private registerHelpers(): void {
    // Format date helper (YYYY-MM -> MMM YYYY)
    Handlebars.registerHelper("formatDate", (date: string | null | undefined) => {
      return formatMonthYear(date)
    })

    // Join array helper
    Handlebars.registerHelper("join", (array: string[], separator: string = ", ") => {
      return array?.join(separator) || ""
    })

    // Conditional helper for array length
    Handlebars.registerHelper("hasItems", (array: unknown[]) => {
      return array && array.length > 0
    })

    // Escape HTML helper (for safety)
    Handlebars.registerHelper("escape", (text: string) => {
      return Handlebars.escapeExpression(text)
    })
  }

  /**
   * Generate a resume PDF from ResumeContent
   */
  async generateResumePDF(
    content: ResumeContent,
    style: string = "modern",
    accentColor: string = "#3B82F6"
  ): Promise<Buffer> {
    try {
      this.logger.info("Generating resume PDF", { style, accentColor })

      // Load and compile template if not already loaded
      if (!this.resumeTemplate) {
        const templatePath = path.join(__dirname, "..", "templates", `resume-${style}.hbs`)
        const templateSource = await fs.readFile(templatePath, "utf-8")
        this.resumeTemplate = Handlebars.compile(templateSource)
      }

      // Load logo and avatar as base64 data URLs (optional)
      const logoDataUrl = await this.loadAssetAsDataUrl("logo.svg", "image/svg+xml")
      const avatarDataUrl = await this.loadAssetAsDataUrl("avatar.jpg", "image/jpeg")

      // Render HTML from template
      const html = this.resumeTemplate({
        ...content,
        accentColor,
        logoDataUrl,
        avatarDataUrl,
      })

      // Generate PDF using Puppeteer
      const pdf = await this.htmlToPDF(html)

      this.logger.info("Resume PDF generated successfully", {
        size: pdf.length,
      })

      return pdf
    } catch (error) {
      this.logger.error("Failed to generate resume PDF", { error })
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Generate a cover letter PDF from CoverLetterContent
   */
  async generateCoverLetterPDF(
    content: CoverLetterContent,
    name: string,
    email: string,
    accentColor: string = "#3B82F6",
    date?: string
  ): Promise<Buffer> {
    try {
      this.logger.info("Generating cover letter PDF")

      // Load and compile template if not already loaded
      if (!this.coverLetterTemplate) {
        const templatePath = path.join(__dirname, "..", "templates", "cover-letter.hbs")
        const templateSource = await fs.readFile(templatePath, "utf-8")
        this.coverLetterTemplate = Handlebars.compile(templateSource)
      }

      // Use provided date or format current date as "MMM YYYY" fallback
      const formattedDate =
        date ||
        new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })

      // Render HTML from template
      const html = this.coverLetterTemplate({
        ...content,
        name,
        email,
        date: formattedDate,
        accentColor,
      })

      // Generate PDF using Puppeteer
      const pdf = await this.htmlToPDF(html)

      this.logger.info("Cover letter PDF generated successfully", {
        size: pdf.length,
      })

      return pdf
    } catch (error) {
      this.logger.error("Failed to generate cover letter PDF", { error })
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Load asset file as base64 data URL
   */
  private async loadAssetAsDataUrl(filename: string, mimeType: string): Promise<string> {
    try {
      const assetPath = path.join(__dirname, "..", "templates", "assets", filename)
      const buffer = await fs.readFile(assetPath)
      return `data:${mimeType};base64,${buffer.toString("base64")}`
    } catch {
      this.logger.warning(`Asset file not found: ${filename}, proceeding without it`)
      return ""
    }
  }

  /**
   * Convert HTML to PDF using Puppeteer
   */
  private async htmlToPDF(html: string): Promise<Buffer> {
    let browser = null

    try {
      // Detect if running locally or in Cloud Functions
      const isLocal =
        process.env.FUNCTIONS_EMULATOR === "true" ||
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test"

      this.logger.info("Launching Puppeteer", { isLocal })

      if (isLocal) {
        // Local development - try to use Chrome channel first, fallback to common paths
        const launchOptions = {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        }

        // Try Chrome channel first (works on most systems)
        try {
          browser = await puppeteer.launch({
            ...launchOptions,
            channel: "chrome",
          })
        } catch {
          // Fallback to common Chrome paths
          const chromePaths = [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
            process.env.CHROME_PATH,
          ].filter((p): p is string => p !== undefined)

          for (const executablePath of chromePaths) {
            try {
              browser = await puppeteer.launch({
                ...launchOptions,
                executablePath,
              })
              break
            } catch {
              continue
            }
          }

          if (!browser) {
            throw new Error(
              "Chrome not found. Please install Chrome or Chromium, or set CHROME_PATH environment variable."
            )
          }
        }
      } else {
        // Cloud Functions - use @sparticuz/chromium
        browser = await puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        })
      }

      const page = await browser.newPage()

      // Set content and wait for fonts/styles to load
      await page.setContent(html, {
        waitUntil: "networkidle0",
      })

      // Generate PDF
      const pdf = await page.pdf({
        format: "Letter",
        printBackground: true,
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
      })

      this.logger.info("PDF generated successfully via Puppeteer")

      return Buffer.from(pdf)
    } catch (error) {
      this.logger.error("Puppeteer PDF generation failed", { error })
      throw error
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }
}

/**
 * Helper function to create a PDF service instance
 */
export function createPDFService(logger?: SimpleLogger): PDFService {
  return new PDFService(logger)
}
