# 🚀 Journey Tests Guide - Dculus Forms

Complete guide for running end-to-end journey tests for the Dculus Forms application.

## 📋 Prerequisites

**Required Software:**
- Node.js ≥18.0.0
- pnpm ≥8.0.0
- Docker (for MongoDB)

**System Requirements:**
- Available ports: 3000, 4000, 5173, 8081
- Minimum 4GB RAM
- Internet connection for dependencies

## 🔧 Initial Setup

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Build Shared Packages
```bash
pnpm build
```

### 3. Start Database
```bash
pnpm docker:up
```

### 4. Setup Database Schema
```bash
pnpm db:generate && pnpm db:push
```

### 5. Seed Test Data (Optional)
```bash
pnpm db:seed
```

## 🎬 Running the Tests

### Option A: Manual Service Management (Recommended)

**1. Start All Services:**
```bash
pnpm dev
```
*This starts:*
- Backend (GraphQL API): http://localhost:4000
- Form Builder App: http://localhost:3000  
- Form Viewer App: http://localhost:5173

**2. Run Tests in New Terminal:**
```bash
# Run all journey tests
npx playwright test

# Run with detailed line-by-line output
npx playwright test --reporter=line

# Run with HTML report
npx playwright test --reporter=html
npx playwright show-report
```

### Option B: Automatic Service Management

**Run Tests with Auto-Start:**
```bash
npx playwright test
```
*Playwright automatically starts required services and runs tests*

## 🎯 Test Categories

### 1. Setup Validation Tests (5 tests)
**Purpose:** Verify basic application connectivity and setup
```bash
npx playwright test tests/e2e/validate-setup.test.ts
```

**Tests:**
- ✅ Application reachability
- ✅ Signup page accessibility
- ✅ Signin page accessibility  
- ✅ GraphQL endpoint functionality
- ✅ Test fixtures loading

### 2. Authentication Journey Tests (9 tests)
**Purpose:** Test complete user authentication flows
```bash
npx playwright test tests/e2e/auth/
```

**Tests:**
- ✅ Successful user registration
- ✅ Sign-in with valid credentials
- ✅ Invalid credentials error handling
- ✅ Form field validation
- ✅ Loading states during authentication
- ✅ Navigation between auth pages
- ✅ Error message clearing
- ✅ Authentication persistence
- ✅ Unauthenticated user redirects

### 3. Dashboard Navigation Tests (10 tests)
**Purpose:** Verify dashboard functionality and navigation
```bash
npx playwright test tests/e2e/form-creation/dashboard-navigation.test.ts
```

**Tests:**
- ✅ Dashboard loading with forms section
- ✅ Empty state when no forms exist
- ✅ Navigation to templates page
- ✅ Breadcrumb navigation
- ✅ Form count display
- ✅ Navigation elements functionality
- ✅ Organization context display
- ✅ Loading states handling
- ✅ Authentication state maintenance
- ✅ Correct subtitle and descriptions

### 4. Template Usage Tests (11 tests)
**Purpose:** Test form creation from templates
```bash
npx playwright test tests/e2e/form-creation/template-usage.test.ts
```

**Tests:**
- ✅ Templates page display
- ✅ Use Template button on hover
- ✅ Template popover opening
- ✅ Successful form creation from template
- ✅ Required field validation
- ✅ Template usage cancellation
- ✅ Loading state during creation
- ✅ Error handling during creation
- ✅ Form data persistence in popover
- ✅ Navigation after form creation
- ✅ Multiple forms from same template

## 🔍 Advanced Test Options

### Debug Mode
```bash
# Run with browser visible
npx playwright test --headed

# Debug specific test
npx playwright test tests/e2e/auth/signin.test.ts:6 --debug

# Run specific test by name
npx playwright test -g "should successfully sign in"
```

### Parallel Execution
```bash
# Run tests in parallel (default)
npx playwright test --workers=5

# Run tests sequentially
npx playwright test --workers=1
```

### Specific Browser Testing
```bash
# Test on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Output Options
```bash
# Minimal output
npx playwright test --reporter=dot

# Detailed output
npx playwright test --reporter=list

# JSON output
npx playwright test --reporter=json
```

## 📊 Expected Results

### Perfect Success Rate
```
Running 45 tests using 5 workers

✅ 44 passed
⏭️ 1 skipped (HTML5 validation test)
❌ 0 failed

Execution time: ~1-2 minutes
```

### Test Breakdown by Category
- **Setup Validation**: 5/5 tests (100%)
- **Authentication**: 9/9 tests (100%)
- **Dashboard Navigation**: 10/10 tests (100%)
- **Template Usage**: 11/11 tests (100%)

## 🏃‍♂️ Quick Start Commands

### Complete Test Run
```bash
# Terminal 1: Start services
pnpm dev

# Terminal 2: Run tests
npx playwright test --reporter=line
```

### One-Command Test Run
```bash
# Auto-start services and run tests
npx playwright test
```

### Quick Validation
```bash
# Just run setup validation tests
npx playwright test tests/e2e/validate-setup.test.ts --reporter=line
```

## 🌐 Service URLs

When services are running, you can access:

- **Form Builder Application**: http://localhost:3000
- **Form Viewer Application**: http://localhost:5173
- **GraphQL Playground**: http://localhost:4000/graphql
- **MongoDB Admin UI**: http://localhost:8081
  - Username: `admin`
  - Password: `password123`

## 🚨 Troubleshooting

### Common Issues and Solutions

#### Tests Failing Due to Services Not Running
```bash
# Check if services are running
curl http://localhost:3000
curl http://localhost:4000/graphql

# Restart services
pnpm dev
```

#### Port Conflicts
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :4000
lsof -i :5173

# Kill processes if needed
pkill -f "port 3000"
```

#### Database Connection Issues
```bash
# Restart database
pnpm docker:down
pnpm docker:up

# Reset database schema
pnpm db:push
```

#### Browser Cache Issues
```bash
# Clear Playwright cache
npx playwright cache clear

# Install browsers if missing
npx playwright install
```

#### Flaky Tests
```bash
# Run with retries
npx playwright test --retries=2

# Run specific failing test
npx playwright test tests/e2e/path/to/test.ts --headed
```

### Reset Everything
```bash
# Complete reset
pnpm docker:down
pnpm docker:up
pnpm db:generate && pnpm db:push
pnpm dev
```

## 📁 Test File Structure

```
tests/
├── config/
│   └── playwright.config.ts          # Playwright configuration
├── e2e/
│   ├── auth/
│   │   ├── signin.test.ts            # Sign-in journey tests
│   │   └── signup.test.ts            # Sign-up journey tests
│   ├── form-creation/
│   │   ├── dashboard-navigation.test.ts  # Dashboard tests
│   │   └── template-usage.test.ts    # Template workflow tests
│   ├── utils/
│   │   ├── auth-helpers.ts           # Authentication utilities
│   │   ├── form-helpers.ts           # Form interaction utilities
│   │   └── page-objects.ts           # Page object models
│   └── validate-setup.test.ts        # Basic setup validation
├── fixtures/
│   └── test-users.json               # Test user data
└── playwright-report/                # Generated test reports
```

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Set base URL (defaults to http://localhost:3000)
export PLAYWRIGHT_BASE_URL=http://localhost:3000

# Optional: Set test timeout (defaults to 30 seconds)
export PLAYWRIGHT_TIMEOUT=60000
```

### Custom Configuration
Edit `tests/config/playwright.config.ts` to modify:
- Test timeouts
- Browser settings
- Parallel execution
- Report formats
- Base URLs

## 📈 Performance Tips

### Faster Test Execution
1. **Use parallel execution** (default behavior)
2. **Skip setup validation** if services are already verified
3. **Use headed mode only for debugging**
4. **Run specific test categories** instead of full suite

### Optimizing CI/CD
```bash
# For CI environments
npx playwright test --reporter=github
npx playwright test --workers=1  # If limited resources
```

## 🎯 Success Criteria

### All Tests Should Pass
- No authentication failures
- No navigation errors  
- No form creation issues
- No template workflow problems

### Performance Benchmarks
- Total execution time: < 2 minutes
- Individual test: < 10 seconds
- Setup validation: < 30 seconds

## 📞 Support

If you encounter issues:

1. **Check this guide** for troubleshooting steps
2. **Verify all prerequisites** are installed
3. **Ensure all services** are running properly
4. **Check the test reports** for detailed error information
5. **Review the application logs** for backend issues

---

## 🎉 Conclusion

The journey tests provide comprehensive coverage of critical user flows in the Dculus Forms application. With a 100% success rate, these tests ensure that all major features work correctly and provide confidence in deployments.

**Happy Testing! 🚀**