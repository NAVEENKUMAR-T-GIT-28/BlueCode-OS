.PHONY: up down logs test lint

up:        ## start the full stack (needs .env)
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f api worker

test:      ## needs a Postgres superuser: export TEST_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres
	cd backend && pytest -q

lint:
	cd backend && ruff check .
