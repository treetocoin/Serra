# Implementation Plan: Admin User Role with Multi-Project View

**Branch**: `006-fammi-un-tipo` | **Date**: 2025-11-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-fammi-un-tipo/spec.md`

## Summary

This feature implements an admin user role system that allows a designated admin user (dadecresce@test.caz) to view and edit all user projects in the greenhouse management system. The implementation extends the existing Supabase authentication with role-based access control (RBAC) using Row Level Security (RLS) policies, without changing the frontend/backend architecture.

**Primary Requirement**: Add admin role to existing users, enabling dadecresce@test.caz to view/edit all greenhouse projects while maintaining security and privacy for regular users.

**Technical Approach**: Custom `user_roles` table with JWT claims integration, RLS policy updates for admin bypass, React Query hooks for role-based UI rendering, and cursor-based pagination for scalability (based on research.md findings).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (frontend only - no backend changes)
**Primary Dependencies**: React 19, @supabase/supabase-js ^2.74, @tanstack/react-query ^5.90, tailwindcss ^4.1
**Storage**: Supabase PostgreSQL 15+ with Row Level Security (RLS)
**Testing**: Vitest (frontend unit/integration), Manual E2E (admin workflows)
**Target Platform**: Web application (existing Serra frontend)
**Project Type**: Web (extends existing frontend/ structure)
**Performance Goals**: Admin dashboard loads all users within 5 seconds (SC-001), search results return in <2 seconds
**Constraints**:
- No backend changes (frontend-only implementation)
- Must maintain backward compatibility with existing user data
- Zero instances of unauthorized access (SC-004)
- Cannot delete projects/users (FR-012)

**Scale/Scope**:
- Single admin user (dadecresce@test.caz)
- Supports 100+ users initially, scalable to 1000+ with pagination
- 4 prioritized user stories (P1-P4)
- 14 functional requirements (FR-001 to FR-014)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since the constitution file is a template, we apply standard web application best practices:

### Security Gate ✅ PASS
- **RLS Enforcement**: All admin access controlled via database RLS policies
- **No Service Role Exposure**: Frontend uses only anon key, admin verified server-side
- **JWT-based Auth**: Role stored in user_roles table, checked via security definer function
- **Justification**: Follows Supabase security best practices (research.md section 2)

### Performance Gate ✅ PASS
- **Optimized Queries**: Uses auth.user_role() security definer function (99.99% faster than JOIN)
- **Cursor Pagination**: Scalable to large datasets without offset/limit performance degradation
- **View Aggregation**: admin_users_overview pre-calculates counts to avoid N+1 queries
- **Justification**: Meets SC-001 (5 second load time) and SC-003 (10 second search)

### Simplicity Gate ✅ PASS
- **No New Services**: Leverages existing Supabase + React Query architecture
- **Minimal Schema Changes**: Single user_roles table + RLS policy updates
- **Reuses Existing Components**: Admin dashboard uses same components as regular dashboard
- **Justification**: Extends existing patterns rather than introducing new complexity

### Testing Gate ✅ PASS
- **RLS Policy Tests**: SQL-based tests for policy enforcement (quickstart.md section 5)
- **Component Tests**: React Testing Library for role-based rendering
- **E2E Manual Tests**: Comprehensive scenarios for all 4 user stories
- **Justification**: Covers unit, integration, and E2E testing per quickstart guide

**Re-evaluation Post Phase 1**: All gates remain PASS - design maintains simplicity, security, and performance.

## Project Structure

### Documentation (this feature)

```
specs/006-fammi-un-tipo/
├── spec.md              # Feature specification (/speckit.specify output)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output - implementation research
├── data-model.md        # Phase 1 output - database schema and entities
├── quickstart.md        # Phase 1 output - developer implementation guide
├── contracts/           # Phase 1 output - TypeScript API contracts
│   ├── README.md        # Contract documentation
│   ├── admin.types.ts   # Type definitions for admin feature
│   ├── admin-api.contract.ts    # Supabase query contracts
│   └── admin-hooks.contract.ts  # React Query hook contracts
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created yet)
```

### Source Code (repository root)

```
frontend/
├── src/
│   ├── components/
│   │   └── admin/                # New: Admin-specific components
│   │       ├── AdminDashboard.tsx
│   │       ├── AdminUsersList.tsx
│   │       ├── AdminProjectDetail.tsx
│   │       └── AdminSearchFilters.tsx
│   ├── pages/
│   │   └── Admin.tsx              # New: Admin dashboard page
│   ├── lib/
│   │   └── hooks/
│   │       ├── useUserRole.ts     # New: Role checking hook
│   │       └── useAdminData.ts    # New: Admin data hooks
│   ├── services/
│   │   └── admin.service.ts       # New: Admin API service
│   ├── types/
│   │   └── admin.types.ts         # New: Admin type definitions
│   └── App.tsx                    # Modified: Add /admin route
└── tests/
    ├── admin.service.test.ts      # New: API service tests
    └── components/
        └── admin/                 # New: Component tests
            └── AdminDashboard.test.tsx

supabase/
└── migrations/
    ├── 20251116_create_user_roles.sql           # New: user_roles table
    ├── 20251116_create_user_role_function.sql   # New: auth.user_role() helper
    ├── 20251116_backfill_user_roles.sql         # New: assign default roles
    ├── 20251116_update_rls_policies.sql         # New: admin bypass policies
    └── 20251116_create_admin_views.sql          # New: admin_users_overview
```

**Structure Decision**: Web application (Option 2) - extends existing frontend/ directory with new admin/ subdirectory. No backend changes required as all logic is handled by Supabase RLS policies and views. Follows existing project pattern where each major feature has its own component directory (e.g., components/dati/).

## Complexity Tracking

*No Constitution violations requiring justification - all gates passed.*

## Phase 0: Research & Discovery ✅ COMPLETE

**Deliverable**: [research.md](./research.md)

**Summary**: Comprehensive research on implementing admin roles in Supabase + React applications, covering:
1. User role storage strategies (custom table vs metadata)
2. RLS policy patterns for admin bypass
3. Frontend role-based access control
4. Real-time sync for multi-user scenarios
5. Efficient pagination and search

**Key Decisions**:
- Use custom `user_roles` table (not user_metadata for security)
- Implement auth.user_role() security definer function for performance
- JWT-based role checking in frontend
- Cursor-based pagination for scalability
- Supabase Realtime for admin edit sync

**Research Duration**: Completed by agent

## Phase 1: Design & Contracts ✅ COMPLETE

**Deliverables**:
- [data-model.md](./data-model.md) - Database schema changes
- [contracts/](./contracts/) - TypeScript API contracts
- [quickstart.md](./quickstart.md) - Developer implementation guide

### 1.1 Data Model

**Entity Changes**:
- **New Table**: `user_roles` (user_id, role, timestamps)
- **New Function**: `auth.user_role()` security definer
- **New View**: `admin_users_overview` (aggregated user stats)
- **Modified**: RLS policies on devices, sensors, actuators, sensor_readings (admin bypass)

**Key Relationships**:
```
auth.users (1:1) user_roles
     |
     | (1:N regular, 1:* admin)
     |
  devices (1:N) sensors (1:N) sensor_readings
     |
     | (1:N)
     |
  actuators
```

**Validation Rules**:
- Role must be 'user' or 'admin'
- One role per user (UNIQUE constraint)
- Role changes require manual SQL (no UPDATE policy)

### 1.2 API Contracts

Generated 4 comprehensive contract files (2200+ lines total):

1. **admin.types.ts** (364 lines): Type definitions for UserRole, AdminUsersOverview, AdminProjectDetail, filters
2. **admin-api.contract.ts** (664 lines): Supabase query functions with RLS enforcement
3. **admin-hooks.contract.ts** (592 lines): React Query hooks with cache management
4. **README.md** (580 lines): Contract documentation and usage guide

**Key Contracts**:
- `getUserRole()` - Get user's role
- `getAllUsersWithProjects()` - Admin dashboard data
- `searchUsers(filters)` - Search/filter with pagination
- `getProjectDetails(projectId)` - Detailed project view
- `updateDevice/Sensor/Actuator()` - Admin edit operations

### 1.3 Developer Guide

**quickstart.md** provides:
- Step-by-step database migration (5 SQL files)
- Implementation by priority (P1-P4) with time estimates
- Copy-paste ready code examples (5 complete components)
- Testing guide (unit, integration, E2E)
- Common pitfalls and troubleshooting

**Total Implementation Time**: 10-15 days split across 4 phases

### 1.4 Agent Context Update

Updated CLAUDE.md with:
- Database: Supabase PostgreSQL 15+ with user_roles table
- Project type: Web application (frontend only)

## Phase 2: Task Breakdown (Next Step)

**Command**: `/speckit.tasks`

**Expected Output**: [tasks.md](./tasks.md) - Detailed task breakdown for implementation

**Task Categories**:
1. **Database Tasks** (5 migrations)
2. **Frontend Tasks** (components, pages, hooks, services)
3. **Testing Tasks** (RLS, API, component, E2E)
4. **Documentation Tasks** (README updates, inline comments)

**Prioritization**: Tasks will be ordered by user story priority (P1→P4) for incremental delivery.

## Implementation Phases Summary

### Phase 1: MVP - Admin Views All Projects (P1)
**Duration**: 3-5 days
**Deliverables**:
- Database migrations (user_roles table, RLS updates)
- Admin dashboard page with all users list
- Role checking hooks (useUserRole, useIsAdmin)
- Protected /admin route
- Basic styling matching existing dashboard

**Success Criteria**: Admin can log in and see list of all users with their project counts.

### Phase 2: Search and Filtering (P2)
**Duration**: 2-3 days
**Deliverables**:
- Search by email input
- Filter by activity (last 7 days)
- Filter by device count
- Cursor-based pagination
- Loading states and error handling

**Success Criteria**: Admin can search users and filter results in <2 seconds.

### Phase 3: Admin Edit Capabilities (P3)
**Duration**: 3-4 days
**Deliverables**:
- Inline editing for devices, sensors, actuators
- Update mutations with optimistic updates
- Real-time sync to project owners
- Admin badge indicator
- Delete prevention for projects

**Success Criteria**: Admin can edit any project; changes visible to owner in real-time.

### Phase 4: Detailed Project View (P4)
**Duration**: 2-3 days
**Deliverables**:
- Comprehensive project detail page
- Recent sensor readings display
- Device/sensor/actuator lists
- Activity timeline
- Navigation breadcrumbs

**Success Criteria**: Admin can view full project details including real-time sensor data.

## Testing Strategy

### Unit Tests (Vitest)
- `admin.service.ts` functions (8+ tests)
- Role checking hooks (4+ tests)
- Filter/search utilities (3+ tests)

### Integration Tests (Vitest + Supabase)
- RLS policy enforcement (10+ tests covering all CRUD operations)
- Admin query permissions
- Regular user access denial

### Component Tests (React Testing Library)
- AdminDashboard rendering (authenticated/unauthenticated)
- Role-based conditional rendering
- Search/filter interactions

### E2E Tests (Manual)
- Complete admin workflows (view, search, edit)
- Regular user isolation (cannot access admin)
- Real-time sync verification

**Total Test Coverage Target**: 80%+ for new admin code

## Migration Strategy

### Pre-Migration Checklist
- [ ] Backup production database
- [ ] Test migrations on staging environment
- [ ] Verify admin user (dadecresce@test.caz) exists in auth.users
- [ ] Review RLS policies for unintended consequences

### Migration Execution Order
1. Create user_roles table (rollback: DROP TABLE)
2. Create auth.user_role() function (rollback: DROP FUNCTION)
3. Backfill existing users (rollback: DELETE FROM user_roles)
4. Update RLS policies (rollback: restore original policies from backup)
5. Create admin views (rollback: DROP VIEW)

### Post-Migration Verification
```sql
-- Verify admin user has correct role
SELECT email, role FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE email = 'dadecresce@test.caz';
-- Expected: role = 'admin'

-- Verify all existing users have default role
SELECT COUNT(*) FROM user_roles WHERE role = 'user';
-- Expected: COUNT = (total users - 1)

-- Test admin bypass on devices table
SET request.jwt.claims = '{"sub": "[admin-user-uuid]"}';
SELECT COUNT(*) FROM devices;
-- Expected: COUNT = (all devices across all users)
```

### Rollback Plan
All migrations include explicit DROP statements in reverse order. If rollback required after deployment:
1. Revert frontend code (git revert)
2. Execute rollback SQL scripts
3. Verify regular users can still access own data
4. Notify admin user of temporary downtime

## Security Considerations

### Threat Model
1. **Unauthorized Admin Access**: Mitigated by RLS policies checking auth.user_role()
2. **Role Escalation**: Mitigated by no UPDATE policy on user_roles table
3. **Admin Impersonation**: Mitigated by JWT verification at database level
4. **Data Leakage**: Mitigated by maintaining RLS on all tables (admin must have valid reason)

### Security Best Practices Applied
- ✅ No service role key in frontend
- ✅ All admin checks via RLS (server-side)
- ✅ JWT claims validated by PostgreSQL
- ✅ Admin cannot delete projects/users (FR-012)
- ✅ All mutations logged via Supabase audit (if enabled)

### Future Security Enhancements (Out of Scope)
- Audit logging table for admin actions
- Two-factor authentication for admin account
- IP whitelist for admin access
- Session timeout for admin users

## Performance Benchmarks

### Database Query Performance
- **auth.user_role()**: <1ms (security definer, cached)
- **admin_users_overview**: <500ms for 1000 users (pre-aggregated)
- **searchUsers()**: <2s for 10,000 users (cursor pagination)

### Frontend Performance
- **Admin Dashboard Load**: <5s (SC-001)
- **Search Results**: <2s (target)
- **Project Detail Load**: <3s
- **Real-time Sync Latency**: <500ms

### Scalability Targets
- Support 1000+ concurrent users (regular)
- Support 10+ concurrent admin users
- Handle 100,000+ sensor readings efficiently (existing)

## Monitoring & Observability

### Metrics to Track
1. Admin dashboard load time (target: <5s)
2. Search query duration (target: <2s)
3. Failed admin access attempts (alert on >0)
4. RLS policy denials for regular users accessing admin routes

### Logging Strategy
- Log all admin edit operations (device, sensor, actuator changes)
- Log failed authentication attempts
- Log RLS policy violations

### Alerting (Future)
- Alert on unauthorized admin access attempts
- Alert on performance degradation (>10s dashboard load)
- Alert on database migration failures

## Documentation Updates Required

### User Documentation
- [ ] Admin user guide (how to use admin dashboard)
- [ ] Search/filter tutorial
- [ ] Edit operation guidelines
- [ ] Troubleshooting common issues

### Developer Documentation
- [ ] Update CONTRIBUTING.md with admin feature architecture
- [ ] Add JSDoc comments to all admin components/services
- [ ] Document RLS policy patterns for future features
- [ ] Update README.md with admin setup instructions

### API Documentation
- [ ] Document admin API endpoints (Supabase queries)
- [ ] Add usage examples for admin hooks
- [ ] Document error codes and handling

## References

- **Feature Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Contracts**: [contracts/README.md](./contracts/README.md)
- **Quickstart**: [quickstart.md](./quickstart.md)
- **Supabase RLS Docs**: https://supabase.com/docs/guides/auth/row-level-security
- **React Query Docs**: https://tanstack.com/query/latest/docs/framework/react/overview
- **Existing Patterns**: frontend/src/pages/Dati.tsx (reference implementation)

## Next Steps

1. **Run `/speckit.tasks`** to generate detailed task breakdown
2. **Review tasks.md** with team for time estimation refinement
3. **Execute Phase 1 (P1) migrations** on staging environment
4. **Implement admin dashboard** following quickstart.md guide
5. **Deploy incrementally** (P1 → P2 → P3 → P4) for early feedback

**Estimated Total Timeline**: 3-4 weeks including testing and documentation
