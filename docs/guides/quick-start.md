# Quick Start Guide

Get Dculus Forms running in 5 minutes!

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker (for PostgreSQL)

## 1. Clone and Install

```bash
git clone <repository-url>
cd dculus-forms
pnpm install
```

## 2. Start Database

```bash
pnpm docker:up
```

## 3. Setup Database

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

## 4. Build Packages

```bash
pnpm build
```

## 5. Start Development

```bash
pnpm dev
```

## Access Applications

- **Form Builder**: http://localhost:3000
- **Form Viewer**: http://localhost:5173
- **Admin Dashboard**: http://localhost:5174
- **GraphQL API**: http://localhost:4000/graphql

## Default Login

- **Email**: `admin@example.com`
- **Password**: `password123`

## Next Steps

- Read [Project Context](../.agent/context.md)
- Check [Coding Conventions](../.agent/conventions.md)
- See [Development Workflows](../.agent/workflows/)

## Need Help?

- [Full Setup Guide](../.agent/workflows/setup.md)
- [Troubleshooting](../README.md#troubleshooting)
- [Documentation Index](./README.md)
