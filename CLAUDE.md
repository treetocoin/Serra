# Serra Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-08

## Active Technologies
- Python 3.11+ (backend), TypeScript 5+ (frontend) + FastAPI 0.104+, React 18+, SQLAlchemy 2.0+, asyncpg, React Query, Vite (001-voglio-fare-una)
- TypeScript 5+ (frontend) + React 18+, Vite, @supabase/supabase-js, React Query, Recharts (extends feature 001 stack) (002-crea-e-implementa)
- Supabase (PostgreSQL + Row Level Security) - add tables for automation rules, conditions, and execution logs (002-crea-e-implementa)
- TypeScript 5.x (frontend), PostgreSQL 15+ (Supabase) + React 19, @supabase/supabase-js ^2.74, @tanstack/react-query ^5.90, recharts ^3.2, tailwindcss ^4.1 (004-deve-funzionare-così)
- Supabase PostgreSQL with Row Level Security (RLS) policies (004-deve-funzionare-così)
- TypeScript 5.9.3 (frontend only - no backend changes) (005-lavoriamo-alla-pagina)
- Supabase PostgreSQL (existing schema - no migrations needed) (005-lavoriamo-alla-pagina)

## Project Structure
```
backend/
frontend/
tests/
```

## Commands
cd src [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] pytest [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] ruff check .

## Code Style
Python 3.11+ (backend), TypeScript 5+ (frontend): Follow standard conventions

## Recent Changes
- 005-lavoriamo-alla-pagina: Added TypeScript 5.9.3 (frontend only - no backend changes)
- 004-deve-funzionare-così: Added TypeScript 5.x (frontend), PostgreSQL 15+ (Supabase) + React 19, @supabase/supabase-js ^2.74, @tanstack/react-query ^5.90, recharts ^3.2, tailwindcss ^4.1
- 002-crea-e-implementa: Added TypeScript 5+ (frontend) + React 18+, Vite, @supabase/supabase-js, React Query, Recharts (extends feature 001 stack)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
