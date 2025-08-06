# Makefile for Socket.IO Server

# Variables
COMPOSE_DEV = docker-compose
COMPOSE_PROD = docker-compose -f docker-compose.prod.yml
SERVICE_NAME = socket-server

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No Color

.PHONY: help dev prod stop clean logs shell install test lint format

# Default target
help: ## Show this help message
	@echo "$(GREEN)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development commands
dev: ## Start development environment
	@echo "$(GREEN)Starting development environment...$(NC)"
	$(COMPOSE_DEV) up --build

dev-d: ## Start development environment in background
	@echo "$(GREEN)Starting development environment in background...$(NC)"
	$(COMPOSE_DEV) up --build -d

dev-logs: ## Show development logs
	@echo "$(GREEN)Showing development logs...$(NC)"
	$(COMPOSE_DEV) logs -f $(SERVICE_NAME)

dev-stop: ## Stop development environment
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	$(COMPOSE_DEV) down

# Production commands
prod: ## Start production environment
	@echo "$(GREEN)Starting production environment...$(NC)"
	$(COMPOSE_PROD) up --build -d

prod-logs: ## Show production logs
	@echo "$(GREEN)Showing production logs...$(NC)"
	$(COMPOSE_PROD) logs -f $(SERVICE_NAME)

prod-stop: ## Stop production environment
	@echo "$(YELLOW)Stopping production environment...$(NC)"
	$(COMPOSE_PROD) down

# Utility commands
stop: ## Stop all containers
	@echo "$(YELLOW)Stopping all containers...$(NC)"
	$(COMPOSE_DEV) down
	$(COMPOSE_PROD) down

clean: ## Clean up containers, volumes, and images
	@echo "$(RED)Cleaning up containers, volumes, and images...$(NC)"
	$(COMPOSE_DEV) down -v --rmi all --remove-orphans
	$(COMPOSE_PROD) down -v --rmi all --remove-orphans
	docker system prune -f

logs: ## Show development logs (alias for dev-logs)
	@echo "$(GREEN)Showing logs...$(NC)"
	$(COMPOSE_DEV) logs -f $(SERVICE_NAME)

shell: ## Access container shell
	@echo "$(GREEN)Accessing container shell...$(NC)"
	$(COMPOSE_DEV) exec $(SERVICE_NAME) sh

# Package management
install: ## Install a package (usage: make install PACKAGE=express-rate-limit)
	@if [ -z "$(PACKAGE)" ]; then \
		echo "$(RED)Usage: make install PACKAGE=package-name$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)Installing $(PACKAGE)...$(NC)"
	$(COMPOSE_DEV) exec $(SERVICE_NAME) npm install --save $(PACKAGE)

install-dev: ## Install a dev package (usage: make install-dev PACKAGE=jest)
	@if [ -z "$(PACKAGE)" ]; then \
		echo "$(RED)Usage: make install-dev PACKAGE=package-name$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)Installing $(PACKAGE) as dev dependency...$(NC)"
	$(COMPOSE_DEV) exec $(SERVICE_NAME) npm install --save-dev $(PACKAGE)

# Testing and linting (optional)
test: ## Run tests (if test script exists in package.json)
	@echo "$(GREEN)Running tests...$(NC)"
	$(COMPOSE_DEV) exec $(SERVICE_NAME) npm test

lint: ## Run linting (if lint script exists in package.json)
	@echo "$(GREEN)Running linting...$(NC)"
	$(COMPOSE_DEV) exec $(SERVICE_NAME) npm run lint

format: ## Format code (if format script exists in package.json)
	@echo "$(GREEN)Formatting code...$(NC)"
	$(COMPOSE_DEV) exec $(SERVICE_NAME) npm run format

# Health check
health: ## Check container health
	@echo "$(GREEN)Checking container health...$(NC)"
	docker ps --filter "name=$(SERVICE_NAME)" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Status
status: ## Show container status
	@echo "$(GREEN)Container status:$(NC)"
	docker ps -a --filter "name=$(SERVICE_NAME)" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}"

# Rebuild
rebuild: ## Rebuild and restart development environment
	@echo "$(GREEN)Rebuilding development environment...$(NC)"
	$(COMPOSE_DEV) down
	$(COMPOSE_DEV) up --build

rebuild-prod: ## Rebuild and restart production environment
	@echo "$(GREEN)Rebuilding production environment...$(NC)"
	$(COMPOSE_PROD) down
	$(COMPOSE_PROD) up --build -d
