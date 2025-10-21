.PHONY: help install dev dev-build dev-stop dev-status dev-logs clean test lint lint-fix functions functions-stop build deploy-staging deploy-prod

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
RESET := \033[0m

help: ## Show this help message
	@echo "$(CYAN)Job Finder Backend - Development Commands$(RESET)"
	@echo "=========================================="
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# ============================================================================
# Standard Development Targets (Consistent across all repos)
# ============================================================================

install: ## Install dependencies
	@echo "$(CYAN)Installing dependencies...$(RESET)"
	@npm install
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"

dev: dev-build functions ## Start development server (build + functions emulator)

dev-build: ## Build TypeScript before development
	@echo "$(CYAN)Building TypeScript...$(RESET)"
	@npm run build
	@echo "$(GREEN)✓ Build complete$(RESET)"

dev-stop: functions-stop ## Stop development server

dev-status: ## Check if Functions emulator is running
	@echo "$(CYAN)Checking Functions emulator status...$(RESET)"
	@if curl -s http://localhost:5001 > /dev/null 2>&1; then \
		echo "$(GREEN)✓ Functions emulator is running (port 5001)$(RESET)"; \
		echo "  View at: http://localhost:5001"; \
	else \
		echo "$(YELLOW)⚠ Functions emulator is not running$(RESET)"; \
		echo "  Start with: make dev"; \
	fi

dev-logs: ## Show development logs
	@echo "$(CYAN)Showing Firebase Functions logs...$(RESET)"
	@firebase functions:log

clean: ## Clean build artifacts and dependencies
	@echo "$(CYAN)Cleaning build artifacts...$(RESET)"
	@npm run clean
	@echo "$(GREEN)✓ Clean complete$(RESET)"

test: ## Run tests
	@echo "$(CYAN)Running tests...$(RESET)"
	@npm test

test-watch: ## Run tests in watch mode
	@echo "$(CYAN)Running tests in watch mode...$(RESET)"
	@npm run test:watch

test-coverage: ## Run tests with coverage
	@echo "$(CYAN)Running tests with coverage...$(RESET)"
	@npm run test:coverage

lint: ## Run linting
	@echo "$(CYAN)Running linter...$(RESET)"
	@npm run lint

lint-fix: ## Auto-fix linting issues
	@echo "$(CYAN)Auto-fixing linting issues...$(RESET)"
	@npm run lint:fix

# ============================================================================
# Backend-Specific Targets
# ============================================================================

functions: ## Start Functions emulator (requires emulators to be running)
	@echo "$(CYAN)Starting Firebase Functions emulator...$(RESET)"
	@echo "$(YELLOW)Prerequisites: Firebase emulators must be running$(RESET)"
	@echo "  Start emulators: cd ../job-finder-FE && make emulators"
	@echo ""
	@npm run serve

functions-stop: ## Stop Functions emulator
	@echo "$(CYAN)Stopping Functions emulator...$(RESET)"
	@lsof -ti:5001 | xargs kill -9 2>/dev/null || echo "$(YELLOW)No process on port 5001$(RESET)"
	@echo "$(GREEN)✓ Functions emulator stopped$(RESET)"

build: ## Build production bundle
	@echo "$(CYAN)Building production bundle...$(RESET)"
	@npm run build
	@echo "$(GREEN)✓ Production build complete$(RESET)"

build-watch: ## Build in watch mode
	@echo "$(CYAN)Building in watch mode...$(RESET)"
	@npm run build:watch

shell: ## Open Firebase Functions shell
	@echo "$(CYAN)Opening Firebase Functions shell...$(RESET)"
	@npm run shell

# ============================================================================
# Deployment Targets
# ============================================================================

deploy-staging: ## Deploy to staging environment
	@echo "$(CYAN)Deploying to staging...$(RESET)"
	@npm run deploy:staging
	@echo "$(GREEN)✓ Deployed to staging$(RESET)"

deploy-prod: ## Deploy to production environment
	@echo "$(RED)⚠ WARNING: Deploying to PRODUCTION!$(RESET)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@npm run deploy
	@echo "$(GREEN)✓ Deployed to production$(RESET)"

logs: ## View Firebase Functions logs
	@echo "$(CYAN)Viewing Firebase Functions logs...$(RESET)"
	@npm run logs

# ============================================================================
# Emulator Helpers (for convenience)
# ============================================================================

emulators: ## Start Firebase emulators (delegates to FE)
	@echo "$(YELLOW)Starting Firebase emulators from job-finder-FE...$(RESET)"
	@cd ../job-finder-FE && make emulators

emulators-stop: ## Stop Firebase emulators
	@echo "$(CYAN)Stopping Firebase emulators...$(RESET)"
	@lsof -ti:8080 | xargs kill -9 2>/dev/null || echo "$(YELLOW)No process on port 8080$(RESET)"
	@lsof -ti:9099 | xargs kill -9 2>/dev/null || echo "$(YELLOW)No process on port 9099$(RESET)"
	@lsof -ti:4000 | xargs kill -9 2>/dev/null || echo "$(YELLOW)No process on port 4000$(RESET)"
	@echo "$(GREEN)✓ Emulators stopped$(RESET)"

# ============================================================================
# Health Checks
# ============================================================================

health-check: ## Run health check for backend services
	@echo "$(CYAN)Running backend health check...$(RESET)"
	@bash ../scripts/dev/health-check.sh

.DEFAULT_GOAL := help
