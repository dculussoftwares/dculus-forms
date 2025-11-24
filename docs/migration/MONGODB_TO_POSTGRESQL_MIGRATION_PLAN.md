# MongoDB to PostgreSQL Migration Plan - Master Document

**Project**: Dculus Forms  
**Migration Date**: TBD  
**Current Database**: MongoDB Atlas (Cloud)  
**Target Database**: PostgreSQL (Cloud)  
**Framework**: Prisma ORM

---

## 📋 Table of Contents

This migration plan is divided into multiple documents for comprehensive coverage:

1. **[MIGRATION_PART_1_OVERVIEW.md](./MIGRATION_PART_1_OVERVIEW.md)** - Executive Summary & Business Analysis
   - Business context and requirements
   - Migration strategy overview
   - Risk assessment and mitigation
   - Timeline and resource planning

2. **[MIGRATION_PART_2_SCHEMA_ANALYSIS.md](./MIGRATION_PART_2_SCHEMA_ANALYSIS.md)** - Database Schema Deep Dive
   - Complete schema comparison (MongoDB vs PostgreSQL)
   - Data type mappings
   - Index strategy changes
   - Constraint definitions

3. **[MIGRATION_PART_3_RESPONSES_ANALYTICS.md](./MIGRATION_PART_3_RESPONSES_ANALYTICS.md)** - Form Responses & Analytics Systems
   - Response storage and filtering architecture
   - Analytics data structures
   - Query optimization strategies
   - Performance considerations

4. **[MIGRATION_PART_4_COLLABORATION.md](./MIGRATION_PART_4_COLLABORATION.md)** - Real-Time Collaboration (YJS/Hocuspocus)
   - YJS document storage strategy
   - Binary data handling
   - WebSocket integration
   - Collaborative state management

5. **[MIGRATION_PART_5_PHASE_PLAN.md](./MIGRATION_PART_5_PHASE_PLAN.md)** - Phase-by-Phase Migration Execution
   - Detailed migration phases
   - Table-by-table migration steps
   - Testing protocols
   - Rollback procedures

6. **[MIGRATION_PART_6_CODE_CHANGES.md](./MIGRATION_PART_6_CODE_CHANGES.md)** - Application Code Changes
   - Repository layer updates
   - Service layer modifications
   - GraphQL resolver changes
   - Query builder adaptations

---

## 🎯 Quick Navigation

### Critical Migration Areas

| Area | Priority | Document | Complexity |
|------|----------|----------|------------|
| Form Responses & Filtering | 🔥 CRITICAL | Part 3 | Very High |
| Analytics Systems | 🔥 CRITICAL | Part 3 | High |
| YJS Collaboration | 🔥 CRITICAL | Part 4 | High |
| Authentication & Organizations | HIGH | Parts 2, 5 | Medium |
| Form Schema & Metadata | HIGH | Parts 2, 5 | Medium |
| Plugin System | MEDIUM | Parts 2, 5 | Medium |
| Subscription Management | MEDIUM | Parts 2, 5 | Low |

### Key Technical Challenges

1. **JSON Field Queries** - MongoDB's flexible JSON querying → PostgreSQL JSONB operators
2. **Binary Data** - YJS collaborative documents stored as Bytes
3. **Date Filtering** - Database-level date filtering in response queries
4. **Full-Text Search** - Analytics and response search capabilities
5. **Atomic Operations** - Subscription usage counters and concurrent updates

---

## 📊 Migration Statistics

### Database Overview

- **Total Tables**: 20
- **Total Indexes**: 35+
- **Average Records per Table**: Varies (see Part 2)
- **Estimated Downtime**: 2-4 hours (with proper planning)
- **Data Volume**: TBD (depends on production data)

### Migration Complexity by Module

```
Authentication & Users:     ████░░░░░░ 40%
Forms & Templates:          ██████░░░░ 60%
Responses & Filtering:      ██████████ 100% (Most Complex)
Analytics:                  ████████░░ 80%
Collaboration (YJS):        █████████░ 90%
Plugins:                    █████░░░░░ 50%
Subscriptions:              ███░░░░░░░ 30%
```

---

## 🚀 Getting Started

### For Project Managers
Start with **Part 1 (Overview)** for business context, timeline, and resource requirements.

### For Database Engineers
Review **Part 2 (Schema Analysis)** and **Part 5 (Phase Plan)** for technical migration details.

### For Backend Developers
Focus on **Part 6 (Code Changes)** and relevant system-specific documents (Parts 3, 4).

### For QA Engineers
Reference **Part 5 (Phase Plan)** for testing protocols and validation procedures.

---

## 📞 Key Contacts & Resources

- **Database Schema**: `apps/backend/prisma/schema.prisma`
- **Repository Layer**: `apps/backend/src/repositories/`
- **Service Layer**: `apps/backend/src/services/`
- **GraphQL Resolvers**: `apps/backend/src/graphql/resolvers/`
- **Query Builders**: `apps/backend/src/services/responseQueryBuilder.ts`

---

## ⚠️ Important Notes

1. **Read ALL documents** before starting migration
2. Follow phases **sequentially** - order matters
3. Test **every phase** before proceeding
4. Maintain **parallel systems** during transition
5. Have **rollback plans** ready at each phase

---

## 📈 Success Metrics

- ✅ Zero data loss
- ✅ Response query performance ≤ current MongoDB performance
- ✅ Analytics queries < 2 seconds
- ✅ Collaboration sync < 100ms
- ✅ All integration tests passing
- ⚪ E2E suite removed (no browser automation coverage)

---

**Next Step**: Read [MIGRATION_PART_1_OVERVIEW.md](./MIGRATION_PART_1_OVERVIEW.md) for business context and migration strategy.
