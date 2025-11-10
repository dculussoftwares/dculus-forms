# Development Environment Configuration
environment       = "dev"
project_name      = "dculus-forms-dev"
cluster_name      = "dculus-forms-dev-mongodb"
database_username = "dculus_app_user_dev"

# Sensitive values provided via GitHub Actions secrets:
# - mongodb_atlas_public_key (from repository secret MONGODB_ATLAS_PUBLIC_KEY)
# - mongodb_atlas_private_key (from repository secret MONGODB_ATLAS_PRIVATE_KEY)
# - mongodb_atlas_org_id (from repository secret MONGODB_ATLAS_ORG_ID)
# - database_password (from environment secret MONGODB_DATABASE_PASSWORD)
