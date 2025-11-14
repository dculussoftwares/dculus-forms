# Cloudflare Managed Transform Setup Guide

## Enable "Add visitor location headers"

Follow these steps to enable all geolocation headers in your Cloudflare account:

### Step 1: Access Transform Rules

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain (e.g., `dculus.com`)
3. Navigate to **Rules** in the left sidebar
4. Click **Transform Rules**
5. Click the **Managed Transforms** tab

### Step 2: Enable Visitor Location Headers

1. Find **"Add visitor location headers"** in the list
2. Toggle the switch to **ON** (blue)
3. Click **Save** or **Deploy**

### Step 3: Verify Deployment

The transform applies immediately. Test with:

```bash
curl -s https://form-services-dev.dculus.com/debug/cloudflare | jq .
```

You should now see these additional headers:
- `cf-ipcontinent`
- `cf-ipcity`
- `cf-region`
- `cf-region-code`
- `cf-postal-code`
- `cf-metro-code`
- `cf-iplatitude`
- `cf-iplongitude`
- `cf-timezone`

## Available Managed Transforms

While you're in the Managed Transforms settings, you may also want to enable:

### Security Headers (Recommended)
- **"Add security headers"** - Adds X-Content-Type-Options, X-Frame-Options, etc.
- **"Remove X-Powered-By headers"** - Hides server technology information

### Other Useful Transforms
- **"Add bot protection headers"** (Enterprise only) - Bot score and verification
- **"Add leaked credentials checks header"** - Credential leak detection

## Troubleshooting

### Headers not appearing?

1. **Check DNS proxy status**
   - Go to **DNS** settings
   - Ensure record has **orange cloud** icon (proxied)
   - Gray cloud = DNS only, no Cloudflare features

2. **Check Managed Transform is enabled**
   - Go to **Rules** > **Transform Rules** > **Managed Transforms**
   - Verify toggle is ON (blue)

3. **Test with curl**
   ```bash
   curl -I https://form-services-dev.dculus.com/health | grep -i cf-
   ```
   Look for `cf-ray` header - if missing, DNS is not proxied

### Some location fields are empty?

This is normal! Geolocation accuracy varies:
- Country: ~99% accurate
- City: ~80% accurate (varies by IP provider)
- Postal code: ~60-70% accurate
- Coordinates: Approximate (often city center)

## Reference

- [Cloudflare Managed Transforms Documentation](https://developers.cloudflare.com/rules/transform/managed-transforms/)
- [Add visitor location headers](https://developers.cloudflare.com/rules/transform/managed-transforms/reference/#add-visitor-location-headers)
- [IP Geolocation Settings](https://developers.cloudflare.com/network/ip-geolocation/)
