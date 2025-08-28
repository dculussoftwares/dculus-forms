# E2E Tests Quick Start Guide

## 🚀 Step-by-Step Instructions

### **Method 1: Manual Service Startup (Recommended for Development)**

1. **Open 3 terminals** in your project root directory

2. **Terminal 1 - Start Backend:**
   ```bash
   pnpm backend:dev
   ```
   Wait for: `🚀 Server running on http://localhost:4000`

3. **Terminal 2 - Start Frontend:**
   ```bash
   pnpm form-app:dev
   ```
   Wait for: `➜  Local:   http://localhost:3000/`

4. **Terminal 3 - Run Tests:**
   ```bash
   pnpm test:e2e:dev
   ```

### **Method 2: Automated (Starts Services Automatically)**

1. **Single Terminal:**
   ```bash
   pnpm test:e2e
   ```
   This will start all services and run tests automatically.

### **Method 3: Debug Mode (Visible Browser)**

1. **Start services** (Method 1, steps 1-2)

2. **Run tests with visible browser:**
   ```bash
   pnpm test:e2e:headed
   ```

## 🔧 If You Have Issues

### **Step 1: Run Diagnostics**
```bash
node test/e2e/diagnose.js
```

### **Step 2: Install Prerequisites**
```bash
# Install Playwright browsers
npx playwright install

# Reinstall dependencies  
pnpm install
```

### **Step 3: Check Services Manually**
```bash
# Test backend
curl http://localhost:4000/health

# Test frontend  
curl http://localhost:3000
```

### **Step 4: Check for Port Conflicts**
```bash
# See what's running on the ports
lsof -i :3000
lsof -i :4000
```

## 🎯 Expected Output

When working correctly, you should see:
```
🚀 Starting E2E test suite...
✅ All services are ready for testing
🎬 Starting scenario: Successful user registration
✅ Successfully filled "Full Name" with value: "John Doe"
...
6 scenarios (6 passed)
23 steps (23 passed)
```

## 🆘 Still Not Working?

**Share these details for help:**

1. **Your exact error message**
2. **Output from diagnostic script:**
   ```bash
   node test/e2e/diagnose.js
   ```
3. **Your environment:**
   ```bash
   node --version
   pnpm --version
   ```

## 📋 What the Tests Do

The e2e tests will:
- ✅ Test successful user registration
- ✅ Test form validation (required fields)  
- ✅ Test email format validation
- ✅ Test password length validation
- ✅ Test password matching validation
- ✅ Test navigation between pages

All tests run against the real application with no mocks!