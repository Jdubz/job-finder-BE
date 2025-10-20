import type { Request, Response, NextFunction } from "express"

type MiddlewareFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>

/**
 * Utility helper to run Express-style middleware within Firebase onRequest handlers.
 * Ensures middleware completion before continuing and resolves even if the middleware
 * sends a response without calling next().
 */
export function runMiddleware(req: Request, res: Response, middleware: MiddlewareFn): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false

    const finish = (err?: unknown) => {
      if (resolved) return
      resolved = true

      if (err) {
        reject(err)
      } else {
        resolve()
      }
    }

    try {
      const result = middleware(req, res, (err?: unknown) => {
        finish(err)
      })

      if (result && typeof (result as Promise<void>).then === "function") {
        ;(result as Promise<void>).then(() => finish()).catch((err: unknown) => finish(err))
      }
    } catch (error) {
      finish(error)
      return
    }

    // If middleware already sent a response (e.g., rate limiter), resolve immediately
    if (res.headersSent) {
      finish()
    }
  })
}
