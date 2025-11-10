# Staging Environment Configuration
environment       = "staging"
project_name      = "dculus-forms-staging"
cluster_name      = "dculus-forms-staging-mongodb"
database_username = "dculus_app_user_staging"

# Sensitive values provided via GitHub Actions secrets:
# - mongodb_atlas_public_key (from repository secret MONGODB_ATLAS_PUBLIC_KEY)
# - mongodb_atlas_private_key (from repository secret MONGODB_ATLAS_PRIVATE_KEY)
# - mongodb_atlas_org_id (from repository secret MONGODB_ATLAS_ORG_ID)
# - database_password (from environment secret MONGODB_DATABASE_PASSWORD)
