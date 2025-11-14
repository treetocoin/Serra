# PostgreSQL Global Uniqueness Constraints - Research Index

**Date**: 2025-11-12
**Project**: Serra Greenhouse Management System
**Feature**: 004-tutto-troppo-complicato (Projects with global uniqueness)
**Status**: Complete Research Package

---

## Overview

This is a comprehensive research package on implementing global uniqueness constraints for multi-tenant applications in PostgreSQL, specifically designed for Serra's greenhouse management system.

**Key Requirements Addressed**:
1. Project names must be globally unique (only one "Main Greenhouse" across entire system)
2. Project IDs must be globally unique (only one PROJ1 across all users)
3. Device IDs must be project-scoped (PROJ1-ESP5 and PROJ2-ESP5 are different devices)
4. Race conditions must be prevented
5. User-friendly error messages must be provided
6. Performance must be acceptable

---

## Research Documents (4 Files)

### 1. **RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md** (46 KB)
**Comprehensive research document covering all theoretical aspects**

**Contents**:
- Executive summary
- 8 major research sections:
  1. UNIQUE constraint strategies (global vs. tenant-scoped vs. project-scoped)
  2. Error handling & user-friendly messages (3 approaches)
  3. Race condition handling (2 solutions: UNIQUE + SERIALIZABLE)
  4. Performance impact analysis (real-world expectations)
  5. Best practices for unique indexes in RLS-protected tables
  6. Validation patterns (application vs. database layer)
  7. Complete implementation example (full schema + services)
  8. Recommendation summary

**Key Sections**:
- Constraint Strategies Comparison Table (4 approaches)
- PostgreSQL Error Codes for Uniqueness Violations
- Race Condition Handling Methods (comparison table)
- Index Overhead & Storage Impact Analysis
- RLS + Uniqueness Integration Patterns
- Validation Pyramid (client, API, database, schema layers)

**Use this document for**:
- Understanding the theory and patterns
- Decision-making framework
- Complex troubleshooting
- Performance optimization
- Best practices reference

**Target Audience**: Architects, senior developers, code reviewers

---

### 2. **RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md** (32 KB)
**Production-ready implementation guide with copy-paste code**

**Contents**:
- Step-by-step implementation (7 steps)
- Complete SQL migrations (ready to copy)
- TypeScript service layer implementations:
  - projectsService.ts (create, list, check availability)
  - devicesServiceV2.ts (create, query, composite ID lookup)
- React component examples:
  - CreateProjectModal (with real-time validation)
  - CreateDeviceModal (with availability dropdown)
- Testing checklist (SQL + TypeScript)
- Migration guide (for existing tables)
- Performance tuning queries
- Debugging guide (common issues + solutions)

**Code Quality**:
- All code is production-ready
- Includes error handling
- TypeScript with full types
- React best practices
- Comments explaining every section

**Use this document for**:
- Implementation (copy-paste code)
- Code review (reference implementation)
- Debugging (common issues section)
- Performance tuning
- Testing (test cases provided)

**Target Audience**: Developers, implementation teams

---

### 3. **RESEARCH_UNIQUENESS_TESTING.sql** (19 KB)
**Comprehensive SQL test suite with 15 test cases**

**Test Suites** (9 test suites, 15 total tests):
1. **Basic Constraint Enforcement** (3 tests)
   - Project name global uniqueness
   - Project ID global uniqueness
   - Device project-scoped uniqueness

2. **Race Condition Handling** (1 test)
   - Simulated concurrent INSERTs

3. **Error Message Quality** (1 test)
   - Verify error provides constraint information

4. **Index Performance Verification** (2 tests)
   - Check indexes exist
   - Measure query performance

5. **RLS + Uniqueness Integration** (1 test)
   - Verify UNIQUE enforced before RLS

6. **Constraint Combinations** (1 test)
   - Multiple constraints together

7. **Data Integrity Checks** (2 tests)
   - No orphaned records
   - UPDATE constraint enforcement

8. **Edge Cases** (3 tests)
   - NULL handling
   - Case sensitivity
   - Long strings

9. **Performance Load Testing** (1 test)
   - Insert performance benchmark

**Features**:
- Ready to run in Supabase SQL Editor
- No setup required (creates own test data)
- Clear output with pass/fail indicators
- Performance metrics included
- Summary report at end

**Use this document for**:
- Verifying implementation
- Performance benchmarking
- Regression testing
- Validation before deployment
- Load testing

**Target Audience**: QA engineers, DevOps, implementation teams

---

### 4. **UNIQUENESS_QUICK_REFERENCE.md** (5 KB)
**One-page quick lookup guide**

**Contents**:
- One-page summary of solution
- Quick decisions table
- File structure overview
- Implementation checklist
- Common code snippets (10 examples)
- Troubleshooting guide
- PostgreSQL concepts table
- Performance expectations
- Quick verification (test commands)
- Resource index
- Next steps

**Format**: Optimized for quick lookup and reference

**Use this document for**:
- Quick lookups during coding
- Decision making
- Troubleshooting
- Performance expectations
- Code snippet copy-paste

**Target Audience**: All developers, quick reference

---

## How to Use This Research Package

### For First-Time Implementation

1. **Start here**: Read UNIQUENESS_QUICK_REFERENCE.md (5 min read)
2. **Understand**: Read RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md, sections 1-3 (30 min)
3. **Implement**: Follow RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md step-by-step (2-3 hours)
4. **Verify**: Run RESEARCH_UNIQUENESS_TESTING.sql in Supabase SQL Editor (30 min)
5. **Deploy**: Monitor performance with provided queries

### For Code Review

1. Compare candidate implementation against RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md
2. Check error handling matches section 2 of RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md
3. Verify performance using Performance Expectations section
4. Run test suite from RESEARCH_UNIQUENESS_TESTING.sql

### For Troubleshooting

1. Check error code in RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md section 2
2. Look up issue in UNIQUENESS_QUICK_REFERENCE.md troubleshooting section
3. Run relevant test from RESEARCH_UNIQUENESS_TESTING.sql
4. Check RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md debugging section

### For Performance Optimization

1. Use Performance Expectations section in UNIQUENESS_QUICK_REFERENCE.md
2. Review Performance Impact section in RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md section 4
3. Run performance queries from RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md
4. Execute performance tests from RESEARCH_UNIQUENESS_TESTING.sql

---

## Key Decision Points

### 1. Global Uniqueness Strategy
**Decision**: Use simple UNIQUE constraint
**Why**: Database-enforced, cannot be bypassed, excellent performance
**Code**: `CREATE TABLE projects (name TEXT NOT NULL UNIQUE);`

### 2. Race Condition Prevention
**Decision**: Rely on UNIQUE constraint enforcement
**Why**: PostgreSQL serializes INSERTs automatically, no application logic needed
**Trade-off**: One user gets error, must retry with different value

### 3. Error Handling
**Decision**: Pre-check (for UX) + Database constraint (for integrity) + Error translation (for messaging)
**Layers**:
- Client: Format validation
- API: Pre-check availability + Rate limiting
- Database: UNIQUE constraint (final defense)

### 4. RLS + Uniqueness
**Decision**: Keep UNIQUE constraint separate from RLS scoping
**Why**: RLS adds access control, UNIQUE adds data integrity (different concerns)
**Pattern**: UNIQUE(name) for global + RLS policies for row-level access

### 5. Scope
**Decision**:
- Project names: GLOBAL UNIQUE
- Project IDs: GLOBAL UNIQUE
- Device IDs: PROJECT-SCOPED UNIQUE
**Pattern**: Use composite UNIQUE(project_id, device_id_short) for scoped uniqueness

---

## Quick Statistics

| Metric | Value |
|--------|-------|
| Total Research Size | ~100 KB |
| Number of Documents | 4 |
| Code Examples | 50+ |
| SQL Test Cases | 15 |
| React Components | 2 |
| Service Methods | 10+ |
| Implementation Steps | 7 |
| TypeScript Test Cases | 5 |
| Design Patterns | 6 |
| Error Codes Covered | 5+ |

---

## File Dependencies

```
RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md
  ├─ Foundation document (no dependencies)
  └─ Referenced by: IMPLEMENTATION_GUIDE, QUICK_REFERENCE

RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md
  ├─ Depends on: GLOBAL_UNIQUENESS_CONSTRAINTS.md (section references)
  ├─ Provides code for: Developers
  └─ Tested by: TESTING.sql

RESEARCH_UNIQUENESS_TESTING.sql
  ├─ Depends on: Database schema from IMPLEMENTATION_GUIDE
  ├─ Validates: Correctness of implementation
  └─ Used by: QA, DevOps

UNIQUENESS_QUICK_REFERENCE.md
  ├─ Depends on: All three documents above
  ├─ Provides: Quick lookup from any document
  └─ Referenced by: Developers during coding

       ┌─────────────────────────────────────┐
       │ GLOBAL_UNIQUENESS_CONSTRAINTS.md   │
       │ (Foundation: Patterns, Theory)      │
       │ (46 KB)                            │
       └──────────────┬──────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
   ┌────▼──────────────────┐   ┌───▼──────────────┐
   │ IMPLEMENTATION_GUIDE  │   │ QUICK_REFERENCE  │
   │ (Developers)          │   │ (Everyone)       │
   │ (32 KB)               │   │ (5 KB)           │
   │ SQL + TS + React      │   │ Lookup + Checklist│
   └────────┬──────────────┘   └──────────────────┘
            │
      ┌─────▼─────────────────────┐
      │ TESTING.sql               │
      │ (QA/DevOps)               │
      │ (19 KB)                   │
      │ 15 Test Cases             │
      └───────────────────────────┘
```

---

## Checklist for Implementation

### Phase 1: Preparation
- [ ] Read UNIQUENESS_QUICK_REFERENCE.md
- [ ] Read sections 1-3 of RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md
- [ ] Review implementation approach in RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md

### Phase 2: Database
- [ ] Copy SQL migrations from IMPLEMENTATION_GUIDE
- [ ] Create projects table with constraints
- [ ] Create devices_v2 table with constraints
- [ ] Create RLS policies
- [ ] Create helper functions
- [ ] Run SQL tests from TESTING.sql

### Phase 3: Backend Services
- [ ] Implement projectsService.ts
- [ ] Implement devicesServiceV2.ts
- [ ] Add error translation functions
- [ ] Add TypeScript tests

### Phase 4: Frontend
- [ ] Build CreateProjectModal component
- [ ] Build CreateDeviceModal component
- [ ] Add real-time validation
- [ ] Add error handling

### Phase 5: Testing & Deployment
- [ ] Run all SQL tests
- [ ] Run TypeScript integration tests
- [ ] Performance testing with provided queries
- [ ] Manual UAT testing
- [ ] Monitor performance in production

---

## When to Reference Each Document

| Scenario | Document | Section |
|----------|----------|---------|
| "How do I implement?" | IMPLEMENTATION_GUIDE | Entire document |
| "Why UNIQUE and not X?" | GLOBAL_CONSTRAINTS | Section 1 |
| "How to handle errors?" | GLOBAL_CONSTRAINTS | Section 2 |
| "Will race conditions happen?" | GLOBAL_CONSTRAINTS | Section 3 |
| "How fast is this?" | QUICK_REFERENCE | Performance Expectations |
| "What's that error 23505?" | QUICK_REFERENCE | PostgreSQL Concepts |
| "Does this test verify X?" | TESTING.sql | Test Suite descriptions |
| "What about RLS + uniqueness?" | GLOBAL_CONSTRAINTS | Section 5 |
| "I need code snippet for X" | IMPLEMENTATION_GUIDE | Code sections |
| "Quick performance check?" | QUICK_REFERENCE | Performance Expectations |

---

## Cross-References Summary

### Error Code 23505 (UNIQUE VIOLATION)
- Defined in: RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md section 2.1
- Handled in: RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md service layer
- Tested in: RESEARCH_UNIQUENESS_TESTING.sql test suites 1 & 2
- Quick ref: UNIQUENESS_QUICK_REFERENCE.md troubleshooting

### Composite Uniqueness Pattern
- Theory: RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md section 1.3
- Implementation: RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md step 2
- Tested: RESEARCH_UNIQUENESS_TESTING.sql test suite 6
- Quick ref: UNIQUENESS_QUICK_REFERENCE.md implementation checklist

### Performance Expectations
- Analysis: RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md section 4
- Validation: RESEARCH_UNIQUENESS_TESTING.sql test suite 9
- Quick ref: UNIQUENESS_QUICK_REFERENCE.md performance table

### RLS Integration
- Patterns: RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md section 5
- Code: RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md migrations
- Verified: RESEARCH_UNIQUENESS_TESTING.sql test suite 5
- Quick ref: UNIQUENESS_QUICK_REFERENCE.md concepts table

---

## Documentation Quality Metrics

| Metric | Value |
|--------|-------|
| Code Examples | 50+ |
| Test Cases | 15 |
| Inline Comments | 100+ |
| Tables & Diagrams | 20+ |
| Error Scenarios | 10+ |
| Edge Cases Covered | 8+ |
| Performance Metrics | 7 |
| Best Practices | 12 |
| Cross-References | 30+ |

---

## Next Steps from Here

1. **Read**: Start with UNIQUENESS_QUICK_REFERENCE.md (5 minutes)
2. **Understand**: Read RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md sections 1-3 (30 minutes)
3. **Plan**: Create implementation plan using IMPLEMENTATION_GUIDE structure
4. **Code**: Follow IMPLEMENTATION_GUIDE step-by-step (2-3 hours)
5. **Test**: Run TESTING.sql to verify (30 minutes)
6. **Deploy**: Monitor with provided performance queries
7. **Review**: Compare against IMPLEMENTATION_GUIDE for best practices

---

## Support & Debugging

### If you encounter an issue:

1. **Check**: UNIQUENESS_QUICK_REFERENCE.md troubleshooting section
2. **Search**: Error code in RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md section 2
3. **Verify**: Run relevant test from RESEARCH_UNIQUENESS_TESTING.sql
4. **Debug**: Check RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md debugging section
5. **Optimize**: Review RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md section 4

### If you need to explain implementation:

1. **To stakeholders**: Use UNIQUENESS_QUICK_REFERENCE.md
2. **To senior devs**: Use RESEARCH_GLOBAL_UNIQUENESS_CONSTRAINTS.md
3. **To team**: Use RESEARCH_UNIQUENESS_IMPLEMENTATION_GUIDE.md
4. **To QA**: Use RESEARCH_UNIQUENESS_TESTING.sql

---

## Document Maintenance

- **Last Updated**: 2025-11-12
- **Research Quality**: Production-ready
- **Code Quality**: Production-ready
- **Test Coverage**: Comprehensive (15 test cases)
- **Performance Analysis**: Complete

---

## How This Package Aligns with Feature 004

**Feature Requirements** → **Research Coverage**:
- "Global uniqueness for project names" → Sections 1.1, 2.2, 7.2
- "Global uniqueness for project IDs" → Sections 1.1, 2.2, 7.1
- "Project-scoped device IDs" → Sections 1.3, 6.2
- "Simple ESP configuration" → Implementation examples throughout
- "Error handling" → Sections 2 & 3, + Implementation Guide
- "Performance" → Section 4, Testing Suite 9
- "RLS integration" → Section 5 & 5.2

---

## License & Usage

All documents in this package are:
- **Internal Use**: For Serra Greenhouse Management System development
- **Reference**: Can be referenced in code comments and documentation
- **Education**: Can be used to train new team members
- **Production**: All code is production-ready

---

**Research Package Complete** ✓

All research documents are ready for implementation.
See UNIQUENESS_QUICK_REFERENCE.md for next steps.
