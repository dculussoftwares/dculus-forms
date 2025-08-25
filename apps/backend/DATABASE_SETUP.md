# Backend with Prisma + MongoDB Setup

This backend uses Prisma with MongoDB for data persistence.

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker (for MongoDB)

## MongoDB Setup

### Option 1: Using Docker (Recommended)

1. **Start Docker** (make sure Docker Desktop is running)

2. **Start MongoDB and Mongo Express**:
   ```bash
   # From the root directory
   docker-compose up -d
   ```

3. **Access MongoDB**:
   - **MongoDB**: `mongodb://admin:password123@localhost:27017/dculus_forms?authSource=admin`
   - **Mongo Express** (Web UI): http://localhost:8081
     - Username: `admin`
     - Password: `password123`

4. **Stop MongoDB**:
   ```bash
   docker-compose down
   ```

### Option 2: Local MongoDB Installation

1. Install MongoDB locally following the [official guide](https://docs.mongodb.com/manual/installation/)

2. Start MongoDB service

3. Update the `DATABASE_URL` in `.env` to match your local setup

## Environment Variables

Copy the `.env` file in the backend directory and modify if needed:

```env
# Database
DATABASE_URL="mongodb://admin:password123@localhost:27017/dculus_forms?authSource=admin&retryWrites=true&w=majority"

# Server
NODE_ENV=development
PORT=4000
```

## Database Commands

```bash
# Generate Prisma Client
pnpm db:generate

# Push schema to database (creates collections)
pnpm db:push

# Open Prisma Studio (database GUI)
pnpm db:studio

# Seed database with sample data
pnpm db:seed
```

## Development Workflow

1. **Start MongoDB**:
   ```bash
   docker-compose up -d
   ```

2. **Generate Prisma Client** (first time only):
   ```bash
   cd apps/backend
   pnpm db:generate
   ```

3. **Push database schema**:
   ```bash
   pnpm db:push
   ```

4. **Start the backend**:
   ```bash
   pnpm backend:dev
   ```

5. **Access the services**:
   - Backend API: http://localhost:4000
   - GraphQL Playground: http://localhost:4000/graphql
   - Mongo Express: http://localhost:8081

## Troubleshooting

### Docker Issues

If you get "Cannot connect to the Docker daemon":
1. Make sure Docker Desktop is running
2. Try restarting Docker Desktop
3. On macOS with Colima: `colima start`

### Connection Issues

If you can't connect to MongoDB:
1. Verify MongoDB is running: `docker ps`
2. Check the logs: `docker logs dculus-forms-mongodb`
3. Verify the DATABASE_URL in `.env`

### Prisma Issues

If Prisma can't find the database:
1. Run `pnpm db:push` to create the database schema
2. Make sure MongoDB is running
3. Check the DATABASE_URL format

## Database Schema

The current schema includes:

- **Forms**: Store form definitions with fields as JSON
- **Responses**: Store form submissions with data as JSON

Both models use MongoDB ObjectId for primary keys and support relationships.
