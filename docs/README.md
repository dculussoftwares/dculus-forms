# Dculus Forms Documentation

Welcome to the Dculus Forms documentation! This directory contains comprehensive guides, architecture documentation, and API references.

## 📚 Documentation Structure

### For AI Assistants
- [`.agent/context.md`](../.agent/context.md) - Project context and architecture overview
- [`.agent/conventions.md`](../.agent/conventions.md) - Coding standards and conventions
- [`.agent/workflows/`](../.agent/workflows/) - Development workflows

### Architecture
- [Plugin System](./architecture/PLUGIN_SYSTEM.md) - Extensible plugin architecture
- [GraphQL Authorization](./architecture/GRAPHQL_AUTHORIZATION_GUIDE.md) - Authorization patterns
- [Subscription Architecture](./architecture/CHARGEBEE_SUBSCRIPTION_ARCHITECTURE.md) - Chargebee integration

### Guides
- [Getting Started](../README.md) - Quick start guide
- [Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md) - Deployment instructions
- [Database Seeding](./guides/DATABASE_SEEDING.md) - Seeding sample data
- [Testing Guide](./testing/TESTING_QUICK_REFERENCE.md) - Testing strategies

### API Documentation
- [GraphQL API](./api/graphql-schema.md) - GraphQL schema and operations
- [REST API](./api/rest-endpoints.md) - REST endpoints (legacy)

### Migration Guides
- [MongoDB to PostgreSQL](./migration/) - Database migration documentation

### Features
- [Quiz Grading](./features/QUIZ_GRADING_PLUGIN.md) - Quiz grading plugin
- [Chargebee Integration](./features/CHARGEBEE_INTEGRATION_GUIDE.md) - Subscription management
- [Form Response Editing](./features/FORM_RESPONSE_EDIT_IMPLEMENTATION_PLAN.md) - Response editing

## 🚀 Quick Links

### Getting Started
1. [Setup Development Environment](../.agent/workflows/setup.md)
2. [Project Architecture](../.agent/context.md)
3. [Coding Conventions](../.agent/conventions.md)

### Common Tasks
- [Adding a New Feature](../.agent/workflows/new-feature.md)
- [Running Tests](../.agent/workflows/testing.md)
- [Database Operations](../.agent/workflows/database.md)
- [Deploying to Production](../.agent/workflows/deployment.md)

### Reference
- [GraphQL Schema](./api/graphql-schema.md)
- [Database Schema](../apps/backend/prisma/schema.prisma)
- [Environment Variables](./guides/environment-variables.md)

## 📖 Documentation by Role

### For Developers
- [Project Context](../.agent/context.md)
- [Coding Conventions](../.agent/conventions.md)
- [Development Setup](../.agent/workflows/setup.md)
- [Adding Features](../.agent/workflows/new-feature.md)

### For DevOps
- [Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md)
- [GitHub Secrets Setup](./deployment/GITHUB_SECRETS_SETUP.md)
- [Database Operations](../.agent/workflows/database.md)

### For QA/Testers
- [Testing Guide](../.agent/workflows/testing.md)
- [Integration Tests](./testing/INTEGRATION_TEST_PLAN.md)
- [E2E Tests](./testing/COMPREHENSIVE_TEST_SCENARIOS_PLAN.md)

### For Product Managers
- [Feature Documentation](./features/)
- [Plugin System](./architecture/PLUGIN_SYSTEM.md)
- [Subscription Architecture](./architecture/CHARGEBEE_SUBSCRIPTION_ARCHITECTURE.md)

## 🔍 Finding Documentation

### By Topic

**Authentication & Authorization**
- [GraphQL Authorization Guide](./architecture/GRAPHQL_AUTHORIZATION_GUIDE.md)
- [Users Management](./features/USERS_MANAGEMENT_IMPLEMENTATION.md)

**Database**
- [Database Workflow](../.agent/workflows/database.md)
- [Database Seeding](./guides/DATABASE_SEEDING.md)
- [Migration Guides](./migration/)

**Testing**
- [Testing Workflow](../.agent/workflows/testing.md)
- [Integration Tests](./testing/INTEGRATION_TEST_PLAN.md)
- [Backend Testing](./testing/BACKEND_TESTING_PLAN.md)

**Deployment**
- [Deployment Workflow](../.agent/workflows/deployment.md)
- [Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md)
- [GitHub Secrets](./deployment/GITHUB_SECRETS_SETUP.md)

**Features**
- [Quiz Grading](./features/QUIZ_GRADING_PLUGIN.md)
- [Chargebee Integration](./features/CHARGEBEE_INTEGRATION_GUIDE.md)
- [Form Response Editing](./features/FORM_RESPONSE_EDIT_IMPLEMENTATION_PLAN.md)

## 📝 Contributing to Documentation

When adding new documentation:

1. **Choose the right location**:
   - Architecture docs → `docs/architecture/`
   - How-to guides → `docs/guides/`
   - API docs → `docs/api/`
   - Feature docs → `docs/features/`
   - Workflows → `.agent/workflows/`

2. **Follow naming conventions**:
   - Use descriptive names
   - Use UPPER_CASE for major docs
   - Use kebab-case for workflow files

3. **Update this index**:
   - Add links to new documentation
   - Keep sections organized

4. **Use markdown best practices**:
   - Include table of contents for long docs
   - Use code blocks with language specification
   - Add examples where helpful
   - Link to related documentation

## 🆘 Getting Help

- Check [README.md](../README.md) for quick start
- Review [context.md](../.agent/context.md) for architecture
- See [conventions.md](../.agent/conventions.md) for coding standards
- Browse [workflows](../.agent/workflows/) for common tasks
- Open an issue on GitHub for questions

## 📋 Documentation Checklist

When creating new features, ensure documentation includes:

- [ ] Feature description and use cases
- [ ] API documentation (GraphQL/REST)
- [ ] Database schema changes
- [ ] Configuration/environment variables
- [ ] Usage examples
- [ ] Testing instructions
- [ ] Deployment considerations
- [ ] Known limitations
