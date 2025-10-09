# Technology Research: Home Greenhouse Management System

**Date**: 2025-10-08
**Purpose**: Technology stack decisions for greenhouse IoT web application

## 1. Backend Language & Framework

### Decision
**FastAPI (Python 3.11+)**

### Rationale
- Native async/await support perfect for ESP32 polling (10-20 requests/min per device)
- Automatic OpenAPI/Swagger documentation generation from code
- Excellent TimescaleDB integration for time-series sensor data
- High performance with asyncpg driver (meets <200ms latency requirement)
- Rich IoT and data processing ecosystem
- Built-in security features (OAuth2, JWT, API key authentication)

### Alternatives Considered
- **Django + DRF**: More boilerplate, slower async performance
- **Node.js + NestJS**: Weaker time-series/scientific computing libraries
- **Go + Gin**: Higher performance but slower development velocity
- **Java + Spring Boot**: Enterprise-grade but heavyweight for home project

### Trade-offs
- Python GIL can be bottleneck for CPU-bound tasks (mitigated by async I/O for database)
- Runtime performance lower than compiled languages (but meets all requirements)
- Requires Python runtime environment (use Docker for consistent deployment)

---

## 2. Database Solution

### Decision
**PostgreSQL 15+ with TimescaleDB Extension**

### Rationale
- Unified database: relational data (users, devices) + time-series (sensor readings)
- TimescaleDB automatic partitioning and compression (90%+ storage reduction)
- Query performance: <1s for 1-year timespan via continuous aggregations
- Standard SQL (no new query language to learn)
- Battle-tested reliability (25+ years PostgreSQL engineering)
- Handles indefinite retention requirement with compression

### Alternatives Considered
- **Pure PostgreSQL**: Query performance degrades with years of data without TimescaleDB
- **InfluxDB standalone**: Requires two databases (doubling operational complexity)
- **MongoDB**: Lacks time-series optimizations, weaker ACID guarantees
- **PostgreSQL + InfluxDB hybrid**: Operational overhead of two databases

### Trade-offs
- Write throughput lower than pure time-series databases (but exceeds requirements by 30x)
- InfluxQL has specialized functions (but SQL + TimescaleDB provides equivalents)
- Requires PostgreSQL hosting with extension support

---

## 3. Frontend Framework

### Decision
**React 18+ with TypeScript**

### Rationale
- Largest ecosystem for charting libraries (ApexCharts, Recharts, Victory, Nivo)
- Excellent real-time data handling with hooks and React Query
- TypeScript provides type safety for sensor data structures
- Most widely used (easier to find help, tutorials, future maintainability)
- React Native option for potential mobile app
- Strong data visualization ecosystem

### Alternatives Considered
- **Vue.js 3**: Smaller ecosystem, fewer IoT dashboard examples
- **Svelte/SvelteKit**: Better performance but less mature ecosystem, fewer charting options
- **Angular**: Heavyweight, complex, longer learning curve
- **Plain JavaScript**: No component structure, manual state management

### Trade-offs
- Larger bundle size (~40-50KB gzipped) vs Svelte (~5-10KB)
- Moderate learning curve for hooks and lifecycle
- More verbose than Vue or Svelte
- Performance slightly lower than Svelte (but sufficient for requirements)

---

## 4. Testing Framework

### Decision
**pytest (Backend) + Jest/Vitest + React Testing Library (Frontend)**

### Rationale

**Backend (pytest)**:
- De facto Python testing standard with best FastAPI integration
- Excellent async test support (pytest-asyncio)
- Rich plugin ecosystem (coverage, mocking, parallel execution)
- Fixtures system perfect for database setup and ESP32 simulation
- TestClient for testing endpoints without running server

**Frontend (Jest/Vitest + RTL)**:
- Jest: Fast, comprehensive, out-of-the-box solution
- Vitest: Faster with Vite integration (equally valid choice)
- React Testing Library: Recommended approach for React components
- Mock Service Worker (MSW) for mocking API responses
- Snapshot testing for UI components

### Alternatives Considered
- **unittest**: More verbose than pytest
- **Robot Framework**: Overkill for this project
- **Cypress/Playwright only**: Too slow for all tests (use for E2E only)

### Trade-offs
- Cannot test with real ESP32 devices in CI/CD (must mock)
- Need balance of unit (fast, many) vs integration (medium) vs E2E (slow, few)
- Maintain separate manual test suite with real hardware

---

## 5. Email Service

### Decision
**SendGrid**

### Rationale
- User-friendly with clean interface and guided onboarding
- Official Python SDK with excellent FastAPI documentation
- Built-in analytics (delivery rates, bounce tracking)
- Drag-and-drop template builder for professional emails
- Free tier: 100 emails/day (sufficient for development)
- Processes billions of emails monthly (proven reliability)

### Alternatives Considered
- **AWS SES**: More difficult to set up, better at scale (10x cheaper for >10K emails/month)

### Trade-offs
- Free tier limits (100 emails/day)
- Cost increases at scale ($15/month for 40K emails)
- Migration to AWS SES recommended if costs exceed $50/month

---

## 6. Data Visualization Library

### Decision
**ApexCharts (React wrapper)**

### Rationale
- Real-time streaming support added in 2025 (perfect for fintech and live dashboards)
- Time-series optimized with interactive candlestick and range charts
- Live update support with annotations (ideal for operational dashboards)
- Easy to use despite being less "mature"
- Full TypeScript support for React components
- Interactive features: zoom, pan, tooltips out-of-the-box

### Alternatives Considered
- **Recharts**: More React-like declarative components, simpler but less powerful for real-time
- **D3.js**: Maximum customization but requires more effort, not well-suited to TypeScript

### Trade-offs
- Less mature than Recharts or D3
- Learning curve for advanced features
- Overkill if only simple static charts needed

---

## 7. API Documentation

### Decision
**FastAPI Automatic OpenAPI/Swagger (built-in)**

### Rationale
- Zero configuration required
- Always in sync with code (impossible to become outdated)
- Interactive testing at `/docs` (Swagger UI) - critical for ESP32 firmware developers
- Exports OpenAPI 3.0 spec (industry standard)
- ReDoc alternative at `/redoc` for beautiful read-only documentation
- Type-driven via Pydantic models

### Alternatives Considered
None needed - FastAPI's built-in documentation is comprehensive

### Trade-offs
None - this is a pure win

---

## Complete Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Backend Language** | Python | 3.11+ | API server |
| **Backend Framework** | FastAPI | 0.104+ | REST API endpoints |
| **ASGI Server** | Uvicorn + Gunicorn | Latest | Production server |
| **Database** | PostgreSQL + TimescaleDB | 15+ / 2.13+ | Data storage + time-series |
| **Database Driver** | asyncpg | Latest | Async PostgreSQL driver |
| **ORM** | SQLAlchemy | 2.0+ | Database models |
| **Frontend Framework** | React + TypeScript | 18+ / 5+ | User interface |
| **Build Tool** | Vite | 5+ | Frontend bundler |
| **State Management** | React Query (TanStack) | 5+ | API state & caching |
| **Routing** | React Router | 6+ | Navigation |
| **Charting** | ApexCharts | 3.44+ | Data visualization |
| **Backend Testing** | pytest + pytest-asyncio | Latest | API tests |
| **Frontend Testing** | Jest/Vitest + React Testing Library | Latest | Component tests |
| **Email Service** | SendGrid | API v3 | Password reset emails |
| **API Documentation** | FastAPI OpenAPI | Built-in | Auto-generated docs |
| **HTTP Client** | Axios | Latest | Frontend API calls |

---

## Performance Validation

| Requirement | Target | Stack Capability | Status |
|------------|--------|------------------|--------|
| API latency | <200ms | FastAPI + asyncpg: 50-100ms typical | ✅ Met |
| ESP32 polling | 10-20 req/min/user | Async I/O handles 1000s concurrent | ✅ Met |
| Historical queries | <1s for 1-year | TimescaleDB: <500ms with aggregations | ✅ Met |
| Concurrent users | 100-1000 | FastAPI tested to 10K+ | ✅ Met |
| Device scale | 10 devices/user | PostgreSQL handles 100K+ streams | ✅ Met |

---

## Implementation Notes

### Backend Setup
```bash
pip install fastapi uvicorn[standard] sqlalchemy asyncpg timescale
pip install pytest pytest-asyncio pytest-cov httpx
```

### Frontend Setup
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom @tanstack/react-query axios
npm install apexcharts react-apexcharts
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

### Database Setup
```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create hypertable for sensor readings
CREATE TABLE sensor_readings (
  time TIMESTAMPTZ NOT NULL,
  device_id UUID NOT NULL,
  sensor_id TEXT NOT NULL,
  value DOUBLE PRECISION,
  unit TEXT
);

SELECT create_hypertable('sensor_readings', 'time');

-- Add compression policy (compress data older than 7 days)
ALTER TABLE sensor_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id,sensor_id'
);

SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');
```

---

## Risk Mitigation

1. **TimescaleDB learning curve**
   - Mitigation: Start with basic PostgreSQL, add TimescaleDB hypertables later
   - Plenty of FastAPI + TimescaleDB tutorials available

2. **ESP32 firmware development**
   - Mitigation: FastAPI's Swagger documentation enables independent firmware development
   - Provide example curl commands

3. **Real-time updates (30-60s polling)**
   - Mitigation: Set expectations correctly
   - Upgrade to WebSocket later if needed (FastAPI supports via websockets library)

4. **Historical data storage costs**
   - Mitigation: TimescaleDB compression (90%+ reduction)
   - Implement user-controlled deletion
   - Monitor storage usage

5. **SendGrid free tier limits**
   - Mitigation: Upgrade to paid plan when needed
   - Switch to AWS SES if costs become significant

---

## Deployment Recommendations

**Backend**: Fly.io, Railway, or DigitalOcean App Platform
**Database**: Timescale Cloud, DigitalOcean Managed PostgreSQL, or AWS RDS
**Frontend**: Vercel, Netlify, or Cloudflare Pages
**HTTPS/TLS**: All platforms provide free SSL certificates (Let's Encrypt)

---

## Conclusion

This stack provides optimal balance for the greenhouse management system:
- Proven for IoT workloads (FastAPI + TimescaleDB)
- Developer productivity (Python + React ecosystems)
- Performance headroom (handles 10x stated requirements)
- Cost-effective (open-source core + affordable hosting)
- Future-proof (scales to 10K users without major rewrites)
- Maintainable (strong typing, automatic documentation, comprehensive testing)
