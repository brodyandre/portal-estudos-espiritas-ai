SHELL := /bin/bash
.DEFAULT_GOAL := help

NPM := npm
PAGES_REPOSITORY := demo/portal-estudos-espiritas-ai

.PHONY: help install dev dev-web dev-api build test lint docker-up docker-down db-up db-down db-migrate db-seed db-studio pages-check clean

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install workspace dependencies
	$(NPM) install

dev: ## Start frontend and API locally
	$(NPM) run dev

dev-web: ## Start only the frontend locally
	$(NPM) run dev:web

dev-api: ## Start only the API locally
	$(NPM) run dev:api

build: ## Build API and frontend
	$(NPM) run build

test: ## Run current automated tests
	$(NPM) run test

lint: ## Run current static checks
	$(NPM) run typecheck

docker-up: ## Build and start Docker services
	docker compose up --build

docker-down: ## Stop Docker services
	docker compose down

db-up: ## Start local PostgreSQL only
	$(NPM) run db:up

db-down: ## Stop local PostgreSQL only
	$(NPM) run db:down

db-migrate: ## Apply local Prisma migrations
	$(NPM) run db:migrate

db-seed: ## Seed local PostgreSQL with safe demo data
	$(NPM) run db:seed

db-studio: ## Open Prisma Studio for the local database
	$(NPM) run db:studio

pages-check: ## Build the frontend as GitHub Pages would
	GITHUB_PAGES=true GITHUB_REPOSITORY=$(PAGES_REPOSITORY) VITE_APP_MODE=demo VITE_API_URL= VITE_SHOW_REAL_MEET_LINK=false VITE_ENABLE_ADMIN_FEATURES=false VITE_ENABLE_TEACHER_FEATURES=false $(NPM) run build:web

clean: ## Remove local build artifacts
	rm -rf apps/api/dist apps/web/dist
