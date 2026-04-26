# PgBouncer Migration Guide

## What Changed

A PgBouncer connection pooler (Azure Container Instance) was added in front of the shared PostgreSQL server.
Apps can now connect via PgBouncer instead of directly to the database.

| Resource | Details |
|---|---|
| **PgBouncer Host** | `dculus-pgbouncer.ejfrc3bugjejc2d6.centralindia.azurecontainer.io` |
| **PgBouncer Port** | `5432` |
| **Pool Mode** | `transaction` (recommended for APIs) |
| **Max Client Connections** | `200` |
| **Pool Size per DB** | `10` real DB connections |
| **Image** | `edoburu/pgbouncer:v1.25.1-p0` |
| **Auth Type** | `scram-sha-256` |

---

## Why PgBouncer?

The PostgreSQL `B_Standard_B1ms` server (1 vCPU, 2 GB RAM) has a hard cap of ~50 connections.
Peak usage was observed at 44 connections — one traffic spike away from `FATAL: sorry, too many clients already`.

PgBouncer allows apps to hold hundreds of connections while only 10 real DB connections are used.

| Metric | Before | After |
|---|---|---|
| Peak DB connections | 44 (88% of cap) | ~10 |
| Memory usage (peak) | 66% | ~50% |
| CPU usage (peak) | 42% | ~32% |
| Monthly cost increase | — | ~$4.50 |

---

## Connection Strings

### Direct PostgreSQL (current — keep as fallback)

```
host=dculus-shared-postgres.postgres.database.azure.com
port=5432
sslmode=require
```

### PgBouncer (new — migrate apps to this)

```
host=dculus-pgbouncer.ejfrc3bugjejc2d6.centralindia.azurecontainer.io
port=5432
sslmode=disable
```

> TLS is handled internally between PgBouncer and PostgreSQL. Apps connect to PgBouncer without SSL.

---

## DATABASE_URL per App

> **Note:** The password contains `+`. In URL-format connection strings, encode it as `%2B`.
> For plain environment variables (not URLs), use the raw password as-is.

| Database | DATABASE_URL (via PgBouncer) |
|---|---|
| `indiastats_cms_db` | `postgresql://dculus_admin:<password>@dculus-pgbouncer.ejfrc3bugjejc2d6.centralindia.azurecontainer.io:5432/indiastats_cms_db?sslmode=disable` |
| `dculus_forms_dev_db` | `postgresql://dculus_admin:<password>@dculus-pgbouncer.ejfrc3bugjejc2d6.centralindia.azurecontainer.io:5432/dculus_forms_dev_db?sslmode=disable` |
| `dculus_forms_prod_db` | `postgresql://dculus_admin:<password>@dculus-pgbouncer.ejfrc3bugjejc2d6.centralindia.azurecontainer.io:5432/dculus_forms_prod_db?sslmode=disable` |
| `dculus_home_site_db` | `postgresql://dculus_admin:<password>@dculus-pgbouncer.ejfrc3bugjejc2d6.centralindia.azurecontainer.io:5432/dculus_home_site_db?sslmode=disable` |

---

## Migration Steps (per app)

1. Find all places `DATABASE_URL`, `DB_HOST`, or connection config is set
   (`.env`, `.env.production`, config files, `docker-compose.yml`, Kubernetes secrets, etc.)

2. Replace the **host** with the PgBouncer host. Keep port `5432`.

3. Change `sslmode` to `disable`.

4. If using URL format, encode `+` in the password as `%2B`.

5. Leave the old direct DB URL as a commented fallback directly above the new value:
   ```env
   # FALLBACK (direct DB) — remove after confirming PgBouncer is stable
   # DATABASE_URL=postgresql://dculus_admin:<password>@dculus-shared-postgres.postgres.database.azure.com:5432/<db>?sslmode=require

   DATABASE_URL=postgresql://dculus_admin:<password>@dculus-pgbouncer.ejfrc3bugjejc2d6.centralindia.azurecontainer.io:5432/<db>?sslmode=disable
   ```

6. If the app has its own connection pool, set the **app-level pool size to 2**.
   PgBouncer handles real pooling — large app-side pools waste resources.

   | Framework | Setting |
   |---|---|
   | Prisma | `?connection_limit=2` in DATABASE_URL |
   | SQLAlchemy | `pool_size=2` |
   | Django | `CONN_MAX_AGE=0` (stateless, let PgBouncer manage) |
   | pg (Node.js) | `max: 2` in pool config |

7. Restart the app and verify health check / DB ping passes.

---

## Rollback

If PgBouncer is unavailable or causing issues, revert the app `DATABASE_URL` to the direct PostgreSQL URL (the commented fallback). No infrastructure changes needed.

---

## Verified Status

Both connection paths tested and confirmed working on 25 April 2026:

```
✅ indiastats_cms_db    — direct + pgbouncer
✅ dculus_forms_dev_db  — direct + pgbouncer
✅ dculus_forms_prod_db — direct + pgbouncer
✅ dculus_home_site_db  — direct + pgbouncer
```

---

## Infrastructure (Terraform)

Resource defined in `main.tf` as `azurerm_container_group.pgbouncer`.
Variables in `variables.tf`: `pgbouncer_pool_mode`, `pgbouncer_max_client_conn`, `pgbouncer_pool_size`.
