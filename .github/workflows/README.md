# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Dculus Forms monorepo.

## Workflows

### CI/CD Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**
1. **Cache Dependencies** - Caches pnpm dependencies for faster builds
2. **Lint and Type Check** - Runs ESLint and TypeScript type checking across all packages
3. **Build** - Builds all applications (backend, form-app, form-viewer) in parallel
4. **Test** - Runs tests across all packages (if tests exist)
5. **Security Audit** - Runs `pnpm audit` to check for security vulnerabilities
6. **Build Summary** - Provides a summary of all completed jobs

### Deploy (`deploy.yml`)

**Triggers:**
- Push to `main` branch only

**Jobs:**
1. **Deploy Backend** - Builds and deploys the Express.js + GraphQL backend
2. **Deploy Frontend** - Builds and deploys both React applications (form-app, form-viewer)
3. **Notify** - Provides deployment summary

## Features

- **Monorepo Support**: Uses pnpm workspaces to manage dependencies and builds
- **Caching**: Efficient caching of pnpm store for faster builds
- **Parallel Builds**: Matrix strategy for building multiple applications simultaneously
- **Artifact Uploads**: Build artifacts are uploaded for potential deployment
- **Error Handling**: Jobs continue on error where appropriate
- **Build Summaries**: Detailed summaries of build and deployment results

## Customization

### Adding Deployment Steps

To add actual deployment steps, edit the `deploy.yml` file and uncomment/add your deployment commands:

```yaml
# Example for backend deployment
- name: Deploy to platform
  run: |
    # Your deployment commands here
    echo "Deploying backend to production..."
```

### Environment Variables

Add environment variables in your GitHub repository settings:
1. Go to Settings > Secrets and variables > Actions
2. Add your deployment secrets (API keys, URLs, etc.)

### Environment Protection

To enable environment protection:
1. Go to Settings > Environments
2. Create a "production" environment
3. Add protection rules as needed
4. Uncomment the `environment: production` lines in `deploy.yml`

## Local Development

To test the build process locally:

```bash
# Install dependencies
pnpm install

# Run linting
pnpm lint

# Run type checking
pnpm type-check

# Build all applications
pnpm build

# Run tests (if available)
pnpm test
```

## Troubleshooting

### Common Issues

1. **Build Failures**: Check that all dependencies are properly installed and TypeScript configurations are correct
2. **Cache Issues**: Clear the pnpm cache if builds are inconsistent
3. **Permission Issues**: Ensure GitHub Actions has proper permissions to access your repository

### Debugging

- Check the Actions tab in your GitHub repository for detailed logs
- Use the build summary to identify which jobs failed
- Review the uploaded artifacts to verify builds completed successfully 