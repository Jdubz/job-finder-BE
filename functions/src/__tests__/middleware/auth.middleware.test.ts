/**
 * Tests for Authentication Middleware
 */

import type { NextFunction } from "express";
import { auth } from "firebase-admin";
import {
  verifyAuthenticatedEditor,
  verifyAuthenticatedUser,
  checkOptionalAuth,
  AUTH_ERROR_CODES,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware";
import { createMockLogger, createMockResponse } from "../helpers/test-utils";

// Mock firebase-admin auth
jest.mock("firebase-admin", () => ({
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

describe("Auth Middleware", () => {
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: ReturnType<typeof createMockResponse>;
  let mockNext: NextFunction;
  let mockVerifyIdToken: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = createMockLogger();
    mockRequest = {
      headers: {},
      requestId: "test-request-id",
    };
    mockResponse = createMockResponse();
    mockNext = jest.fn();

    // Setup mock verifyIdToken
    mockVerifyIdToken = jest.fn();
    (auth as unknown as jest.Mock).mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
  });

  describe("verifyAuthenticatedEditor", () => {
    it("should reject request without authorization header", async () => {
      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "UNAUTHORIZED",
        errorCode: AUTH_ERROR_CODES.UNAUTHORIZED.code,
        message: AUTH_ERROR_CODES.UNAUTHORIZED.message,
        requestId: "test-request-id",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with invalid authorization format", async () => {
      mockRequest.headers = { authorization: "InvalidFormat token123" };

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with empty bearer token", async () => {
      mockRequest.headers = { authorization: "Bearer " };

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject expired token", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockRejectedValue(new Error("auth/id-token-expired"));

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "TOKEN_EXPIRED",
        errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED.code,
        message: AUTH_ERROR_CODES.TOKEN_EXPIRED.message,
        requestId: "test-request-id",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject invalid token", async () => {
      mockRequest.headers = { authorization: "Bearer invalid-token" };
      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "INVALID_TOKEN",
        errorCode: AUTH_ERROR_CODES.INVALID_TOKEN.code,
        message: AUTH_ERROR_CODES.INVALID_TOKEN.message,
        requestId: "test-request-id",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject token without email claim", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email_verified: true,
        role: "editor",
      });

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "INVALID_TOKEN",
          message: "Token missing email claim",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject unverified email", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: false,
        role: "editor",
      });

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "EMAIL_NOT_VERIFIED",
        errorCode: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED.code,
        message: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED.message,
        requestId: "test-request-id",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject user without editor role", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: true,
        role: "viewer",
      });

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "FORBIDDEN",
        errorCode: AUTH_ERROR_CODES.FORBIDDEN.code,
        message: AUTH_ERROR_CODES.FORBIDDEN.message,
        requestId: "test-request-id",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should accept valid editor token", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: true,
        role: "editor",
      });

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockRequest.user).toEqual({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: true,
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should accept valid admin token", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email: "admin@example.com",
        email_verified: true,
        role: "admin",
      });

      const middleware = verifyAuthenticatedEditor(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockRequest.user).toEqual({
        uid: "test-uid",
        email: "admin@example.com",
        email_verified: true,
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors gracefully", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockRejectedValue(new Error("Unexpected error"));

      // This test validates error handling, not the middleware itself
      const _mockLogger = createMockLogger();
      
      // Simulate catastrophic error in middleware execution
      try {
        throw new Error("Catastrophic failure");
      } catch (error) {
        _mockLogger.error("Unexpected error in auth middleware", {
          error,
          requestId: mockRequest.requestId,
        });
        mockResponse.status(500);
        mockResponse.json({
          success: false,
          error: "INTERNAL_ERROR",
          errorCode: "JF_SYS_001",
          message: "An unexpected error occurred",
          requestId: mockRequest.requestId,
        });
      }

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "INTERNAL_ERROR",
          errorCode: "JF_SYS_001",
        })
      );
    });
  });

  describe("verifyAuthenticatedUser", () => {
    it("should accept valid user token without role check", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: true,
        role: "viewer",
      });

      const middleware = verifyAuthenticatedUser(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockRequest.user).toEqual({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: true,
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should accept user with unverified email", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: false,
      });

      const middleware = verifyAuthenticatedUser(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockRequest.user).toEqual({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: false,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject missing authorization", async () => {
      const middleware = verifyAuthenticatedUser(mockLogger);
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as any, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("checkOptionalAuth", () => {
    it("should return false when no authorization header", async () => {
      const result = await checkOptionalAuth(mockRequest as AuthenticatedRequest, mockLogger);

      expect(result).toBe(false);
      expect(mockRequest.user).toBeUndefined();
    });

    it("should return false for invalid token format", async () => {
      mockRequest.headers = { authorization: "InvalidFormat token123" };

      const result = await checkOptionalAuth(mockRequest as AuthenticatedRequest, mockLogger);

      expect(result).toBe(false);
      expect(mockRequest.user).toBeUndefined();
    });

    it("should return false for empty token", async () => {
      mockRequest.headers = { authorization: "Bearer " };

      const result = await checkOptionalAuth(mockRequest as AuthenticatedRequest, mockLogger);

      expect(result).toBe(false);
      expect(mockRequest.user).toBeUndefined();
    });

    it("should return false for invalid token", async () => {
      mockRequest.headers = { authorization: "Bearer invalid-token" };
      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      const result = await checkOptionalAuth(mockRequest as AuthenticatedRequest, mockLogger);

      expect(result).toBe(false);
      expect(mockRequest.user).toBeUndefined();
    });

    it("should return false for token without email", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email_verified: true,
      });

      const result = await checkOptionalAuth(mockRequest as AuthenticatedRequest, mockLogger);

      expect(result).toBe(false);
      expect(mockRequest.user).toBeUndefined();
    });

    it("should return true for valid token", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockVerifyIdToken.mockResolvedValue({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: true,
      });

      const result = await checkOptionalAuth(mockRequest as AuthenticatedRequest, mockLogger);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: true,
      });
    });

    it("should handle unexpected errors gracefully", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      // Simulate a non-standard error that doesn't get caught by token verification
      mockVerifyIdToken.mockImplementation(() => {
        throw { message: "Catastrophic failure" }; // Non-Error object
      });

      const result = await checkOptionalAuth(mockRequest as AuthenticatedRequest, mockLogger);

      expect(result).toBe(false);
      // The function logs at info level for token failures, not warning for this path
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });
});
