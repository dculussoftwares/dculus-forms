# Chargebee Setup Script

This script automatically configures your Chargebee account with all required plans, features, and pricing for Dculus Forms.

## Prerequisites

1. **Chargebee Account**: Sign up at [https://www.chargebee.com/](https://www.chargebee.com/)
2. **Product Catalog 2.0**: Ensure your site is using Product Catalog 2.0 (all new sites use this by default)
3. **API Credentials**: Get your API key from Chargebee dashboard

## Getting Your Chargebee Credentials

1. Log in to your Chargebee dashboard
2. Go to **Settings** → **Configure Chargebee** → **API Keys and Webhooks**
3. Copy your **Site Name** (e.g., `dculus-test`)
4. Copy your **API Key** (starts with `live_` or `test_`)

## Configuration

Update `apps/backend/.env` with your Chargebee credentials:

```bash
CHARGEBEE_SITE="your-site-name"
CHARGEBEE_API_KEY="your-api-key"
```

**Important:** Use your **test** environment credentials first to avoid creating plans in production!

## Running the Setup Script

```bash
# Navigate to backend directory
cd apps/backend

# Run the setup script
npx tsx src/scripts/setup-chargebee.ts
```

## What Gets Created

### Features
- **form_views** - Metered feature for tracking form views
  - Levels: 10,000 views, Unlimited
- **form_submissions** - Metered feature for tracking form submissions
  - Levels: 1,000, 10,000, 100,000, Unlimited

### Plan Items
- **free** - Free Plan
- **starter** - Starter Plan
- **advanced** - Advanced Plan

### Item Prices (Multi-Currency)
| Plan ID | Currency | Price/Month | Views | Submissions |
|---------|----------|-------------|-------|-------------|
| free-usd-monthly | USD | $0 | 10,000 | 1,000 |
| free-inr-monthly | INR | ₹0 | 10,000 | 1,000 |
| starter-usd-monthly | USD | $6 | Unlimited | 10,000 |
| starter-inr-monthly | INR | ₹489 | Unlimited | 10,000 |
| advanced-usd-monthly | USD | $15 | Unlimited | 100,000 |
| advanced-inr-monthly | INR | ₹1,289 | Unlimited | 100,000 |

### Entitlements
The script automatically links features to plans with the correct usage limits.

## Expected Output

```
🚀 Chargebee Setup Script Starting...

📍 Site: dculus-test

📦 Step 1: Creating Features...

  ✅ Created feature: form_views
  ✅ Created feature: form_submissions

📋 Step 2: Creating Plan Items...

  ✅ Created plan item: free
  ✅ Created plan item: starter
  ✅ Created plan item: advanced

💰 Step 3: Creating Item Prices...

  ✅ Created price: free-usd-monthly ($0.00/month)
  ✅ Created price: free-inr-monthly (₹0.00/month)
  ✅ Created price: starter-usd-monthly ($6.00/month)
  ✅ Created price: starter-inr-monthly (₹489.00/month)
  ✅ Created price: advanced-usd-monthly ($15.00/month)
  ✅ Created price: advanced-inr-monthly (₹1,289.00/month)

🔗 Step 4: Linking Features to Plans (Entitlements)...

  ✅ Configured entitlements for Free (USD):
     - form_views: 10,000
     - form_submissions: 1,000
  ✅ Configured entitlements for Free (INR):
     - form_views: 10,000
     - form_submissions: 1,000
  ✅ Configured entitlements for Starter (USD):
     - form_views: Unlimited
     - form_submissions: 10,000
  ✅ Configured entitlements for Starter (INR):
     - form_views: Unlimited
     - form_submissions: 10,000
  ✅ Configured entitlements for Advanced (USD):
     - form_views: Unlimited
     - form_submissions: 100,000
  ✅ Configured entitlements for Advanced (INR):
     - form_views: Unlimited
     - form_submissions: 100,000

✅ Chargebee setup complete!

📊 Summary:
  • Features created: form_views, form_submissions
  • Plans created: free, starter, advanced
  • Item prices created: 6 (3 plans × 2 currencies)
  • Entitlements configured: 6 plan prices

🎉 You can now view your plans in the Chargebee dashboard!
   https://dculus-test.chargebee.com/
```

## Verifying the Setup

1. Log in to your Chargebee dashboard
2. Go to **Product Catalog** → **Features**
   - Verify `form_views` and `form_submissions` exist
3. Go to **Product Catalog** → **Plans**
   - Verify `free`, `starter`, and `advanced` exist
4. Click on each plan to view:
   - Item prices for USD and INR
   - Entitlements (feature limits)

## Re-running the Script

The script is **idempotent** - you can run it multiple times safely. If items already exist, it will skip creation and show warnings:

```
⚠️  form_views feature already exists (skipping)
⚠️  free plan item already exists (skipping)
```

## Troubleshooting

### Error: "Missing Chargebee credentials"
- Check that `.env` file has `CHARGEBEE_SITE` and `CHARGEBEE_API_KEY`
- Make sure you're in the `apps/backend` directory

### Error: "Invalid API key"
- Verify your API key is correct
- Check you're using the right environment (test vs live)

### Error: "resource_already_exists"
- This is normal if you've run the script before
- The script will skip existing items automatically

### Error: "Multi-currency not enabled"
- Go to Chargebee dashboard → Settings → Multi-Currency
- Enable USD and INR currencies
- Re-run the script

## Next Steps

After successful setup:
1. ✅ Verify plans in Chargebee dashboard
2. 🚀 Proceed with Phase 1: Database & Events implementation
3. 🔗 Integrate Chargebee with your application

## Support

- [Chargebee API Documentation](https://apidocs.chargebee.com/)
- [Product Catalog 2.0 Guide](https://www.chargebee.com/docs/2.0/product-catalog.html)
- [Metered Billing Setup](https://www.chargebee.com/docs/2.0/metered-billing.html)
