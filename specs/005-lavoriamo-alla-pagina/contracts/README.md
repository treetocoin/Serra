# API Contracts: Pagina Dati

**Feature**: 005-lavoriamo-alla-pagina
**Date**: 2025-11-14

## Overview

This directory contains the API contract definitions for the "Dati" page. Since the feature uses Supabase as the backend with direct client-side queries (no REST/GraphQL API layer), the "contracts" are defined as:

1. **Supabase Query Interfaces**: TypeScript interfaces describing the shape of data returned from Supabase queries
2. **Service Layer Contracts**: Function signatures for the data access layer (`services/*.ts`)
3. **React Query Key Patterns**: Standardized cache keys for React Query

This ensures consistency across components and enables contract-first development.

---

## Contract Files

1. **`supabase-queries.contract.ts`**: Supabase query shapes and return types
2. **`service-layer.contract.ts`**: Service function signatures
3. **`react-query-keys.contract.ts`**: Query key patterns for caching

---

## Version

**Contract Version**: 1.0.0
**Breaking Changes**: None (initial implementation)
