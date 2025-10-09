# Quick Start Guide: Home Greenhouse Management System

**Date**: 2025-10-08
**For Developers**: Setting up local development environment

## Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18 or higher
- **PostgreSQL**: 15 or higher
- **Docker**: Optional (recommended for PostgreSQL + TimescaleDB)
- **Git**: For version control

---

## Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │◄───────►│   Backend    │◄───────►│  PostgreSQL │
│  (React +   │   HTTP  │   (FastAPI)  │   SQL   │    + Time   │
│  TypeScript)│         │              │         │   ScaleDB   │
└─────────────┘         └──────────────┘         └─────────────┘
                                ▲
                                │ HTTP/HTTPS
                                │ (30-60s polling)
                                ▼
                        ┌──────────────┐
                        │   ESP32      │
                        │   Devices    │
                        └──────────────┘
```

---

## Part 1: Database Setup

### Option A: Docker (Recommended)

1. **Create docker-compose.yml** in project root:

```yaml
version: '3.8'

services:
  postgres:
    image: timescale/timescaledb:latest-pg15
    container_name: greenhouse_db
    environment:
      POSTGRES_DB: greenhouse
      POSTGRES_USER: greenhouse_user
      POSTGRES_PASSWORD: changeme
    ports:
      - "5432:5432"
    volumes:
      - greenhouse_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  greenhouse_data:
```

2. **Start PostgreSQL + TimescaleDB**:

```bash
docker-compose up -d
```

3. **Verify connection**:

```bash
docker exec -it greenhouse_db psql -U greenhouse_user -d greenhouse
```

```sql
-- Inside psql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Verify TimescaleDB
SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';

-- Exit psql
\q
```

### Option B: Local PostgreSQL Installation

1. Install PostgreSQL 15+ and TimescaleDB extension
2. Create database and user:

```bash
psql -U postgres
```

```sql
CREATE DATABASE greenhouse;
CREATE USER greenhouse_user WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE greenhouse TO greenhouse_user;

\c greenhouse
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q
```

---

## Part 2: Backend Setup (FastAPI)

1. **Navigate to backend directory**:

```bash
mkdir -p backend/src
cd backend
```

2. **Create Python virtual environment**:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Create requirements.txt**:

```txt
# Core
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6

# Database
sqlalchemy==2.0.23
asyncpg==0.29.0
alembic==1.12.1

# Authentication
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6

# Email
sendgrid==6.11.0

# Utilities
pydantic==2.5.0
pydantic-settings==2.1.0
python-dotenv==1.0.0

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.25.2
```

4. **Install dependencies**:

```bash
pip install -r requirements.txt
```

5. **Create .env file** in backend root:

```env
# Database
DATABASE_URL=postgresql+asyncpg://greenhouse_user:changeme@localhost:5432/greenhouse

# JWT
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# SendGrid (get free API key from sendgrid.com)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@greenhouse.example.com

# API
API_V1_PREFIX=/api/v1
```

6. **Initialize Alembic (database migrations)**:

```bash
alembic init migrations
```

7. **Edit alembic.ini** - update sqlalchemy.url:

```ini
# Remove or comment out:
# sqlalchemy.url = driver://user:pass@localhost/dbname

# (We'll use DATABASE_URL from .env instead)
```

8. **Edit migrations/env.py** - configure for async:

```python
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import your models here
# from src.models import Base

config = context.config
config.set_main_option('sqlalchemy.url', os.getenv('DATABASE_URL'))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# target_metadata = Base.metadata  # Uncomment when models exist
target_metadata = None

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

9. **Create minimal FastAPI app** - `src/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Home Greenhouse Management API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Greenhouse Management API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

10. **Run backend**:

```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

11. **Test backend**:

Open browser: http://localhost:8000/docs (Swagger UI)

---

## Part 3: Frontend Setup (React + TypeScript)

1. **Navigate to project root and create frontend**:

```bash
cd ..  # Back to project root
npm create vite@latest frontend -- --template react-ts
cd frontend
```

2. **Install dependencies**:

```bash
npm install
npm install react-router-dom @tanstack/react-query axios
npm install apexcharts react-apexcharts
npm install -D @types/node
```

3. **Create .env file** in frontend root:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

4. **Create API client** - `src/services/api.ts`:

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (redirect to login)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

5. **Update App.tsx** with basic routing:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<div>Dashboard (TODO)</div>} />
            <Route path="/devices" element={<div>Devices (TODO)</div>} />
            <Route path="/login" element={<div>Login (TODO)</div>} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

6. **Run frontend**:

```bash
npm run dev
```

Frontend available at: http://localhost:5173

---

## Part 4: Verify Full Stack

1. **Backend running**: http://localhost:8000/docs
2. **Frontend running**: http://localhost:5173
3. **Database running**: `docker ps` (should show greenhouse_db)

Test API from frontend:

```typescript
// In browser console at http://localhost:5173
fetch('http://localhost:8000/health')
  .then(r => r.json())
  .then(console.log);
```

Should return: `{status: "healthy"}`

---

## Part 5: Database Schema (First Migration)

Once models are implemented in `backend/src/models/`, create migration:

```bash
cd backend
source venv/bin/activate

# Generate migration from models
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head

# Verify tables created
docker exec -it greenhouse_db psql -U greenhouse_user -d greenhouse -c "\dt"
```

---

## Project Structure

After setup, your structure should look like:

```
greenhouse-management/
├── docker-compose.yml
├── backend/
│   ├── venv/
│   ├── migrations/
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── models/          # (to be created)
│   │   ├── api/             # (to be created)
│   │   ├── services/        # (to be created)
│   │   └── middleware/      # (to be created)
│   ├── tests/               # (to be created)
│   ├── requirements.txt
│   ├── .env
│   └── alembic.ini
├── frontend/
│   ├── node_modules/
│   ├── src/
│   │   ├── components/      # (to be created)
│   │   ├── pages/           # (to be created)
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env
└── specs/
    └── 001-voglio-fare-una/
        ├── spec.md
        ├── plan.md
        ├── research.md
        ├── data-model.md
        ├── quickstart.md (this file)
        └── contracts/
            └── openapi.yaml
```

---

## Next Steps

After setup completion:

1. **Implement Models**: Create SQLAlchemy models in `backend/src/models/` based on `data-model.md`
2. **Run First Migration**: `alembic revision --autogenerate -m "Initial schema" && alembic upgrade head`
3. **Implement Authentication**: Add `/auth/register` and `/auth/login` endpoints
4. **Implement Device Management**: Add device registration and API key generation
5. **Build React Components**: Create login, dashboard, and device management UIs
6. **Add Testing**: Write pytest tests for backend, Jest/Vitest for frontend

Refer to:
- **API Contracts**: `contracts/openapi.yaml`
- **Data Model**: `data-model.md`
- **Tech Stack Details**: `research.md`
- **Full Plan**: `plan.md`

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
docker exec -it greenhouse_db psql -U greenhouse_user -d greenhouse

# Check logs
docker logs greenhouse_db

# Restart database
docker-compose restart postgres
```

### Backend Issues

```bash
# Check if port 8000 is in use
lsof -i :8000

# Check FastAPI logs in terminal running uvicorn
# Verify .env file exists and DATABASE_URL is correct
```

### Frontend Issues

```bash
# Check if port 5173 is in use
lsof -i :5173

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check VITE_API_BASE_URL in .env
```

### CORS Issues

If frontend can't reach backend:

1. Verify CORS origins in `backend/src/main.py` include `http://localhost:5173`
2. Check browser console for CORS errors
3. Verify backend is running on port 8000

---

## Development Workflow

1. **Start database**: `docker-compose up -d`
2. **Start backend**: `cd backend && source venv/bin/activate && uvicorn src.main:app --reload`
3. **Start frontend**: `cd frontend && npm run dev`
4. **Access**:
   - Frontend: http://localhost:5173
   - Backend API Docs: http://localhost:8000/docs
   - Database: `psql -h localhost -U greenhouse_user -d greenhouse`

---

## Running Tests

### Backend Tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -v --cov=src
```

### Frontend Tests

```bash
cd frontend
npm test
```

---

## ESP32 Development

For ESP32 firmware development:

1. **API Documentation**: http://localhost:8000/docs
2. **Example Sensor Data POST**:

```http
POST http://localhost:8000/api/v1/sensors/data
X-API-Key: <device-api-key>
Content-Type: application/json

{
  "device_id": "uuid-here",
  "readings": [
    {"sensor_id": "temp_1", "sensor_type": "temperature", "value": 22.5, "unit": "C"},
    {"sensor_id": "humidity_1", "sensor_type": "humidity", "value": 65.0, "unit": "%"}
  ],
  "timestamp": "2025-10-08T10:30:00Z"
}
```

3. **Poll for Commands**:

```http
GET http://localhost:8000/api/v1/actuators/commands
X-API-Key: <device-api-key>
```

See `contracts/openapi.yaml` for full API specification.

---

## Production Deployment

Before deploying to production:

1. **Change SECRET_KEY** in backend .env
2. **Configure CORS origins** to actual frontend domain
3. **Set up managed PostgreSQL** (Timescale Cloud, AWS RDS, etc.)
4. **Configure SendGrid** with production email
5. **Enable HTTPS** for both frontend and backend
6. **Set environment variables** (don't commit .env files)
7. **Run database backups**
8. **Configure monitoring** (logs, error tracking)

Recommended hosting:
- **Backend**: Fly.io, Railway, or DigitalOcean App Platform
- **Frontend**: Vercel or Netlify
- **Database**: Timescale Cloud or DigitalOcean Managed PostgreSQL

---

## Additional Resources

- **FastAPI Documentation**: https://fastapi.tiangolo.com
- **React Documentation**: https://react.dev
- **TimescaleDB Documentation**: https://docs.timescale.com
- **SQLAlchemy 2.0**: https://docs.sqlalchemy.org
- **Alembic Migrations**: https://alembic.sqlalchemy.org
- **React Query**: https://tanstack.com/query
- **ApexCharts**: https://apexcharts.com/docs/react-charts/

---

**Status**: ✅ Development environment ready
**Next Command**: `/speckit.tasks` to generate implementation task breakdown
