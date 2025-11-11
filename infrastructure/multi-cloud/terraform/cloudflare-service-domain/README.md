# Cloudflare Service Domain

This Terraform stack manages the `form-services-{env}.dculus.com` hostname and
routes it to the Azure Container App that hosts the backend API. The `backend_fqdn`
variable is supplied by the Azure deployment workflow so the DNS CNAME is always
kept in sync with the currently provisioned container app.

Each environment folder (`environments/{env}`) provides the backend configuration
for remote state and the basic variables required by the shared Terraform files.

