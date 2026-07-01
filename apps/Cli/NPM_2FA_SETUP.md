# Fixing NPM Publish 2FA Error

## The Problem

NPM requires two-factor authentication (2FA) to publish packages. You're seeing this error:
```
403 Forbidden - Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

## Solution 1: Enable 2FA (Recommended)

### Step 1: Enable 2FA on NPM

1. **Visit NPM website**: Go to https://www.npmjs.com/login
2. **Login to your account**
3. **Go to Account Settings**: Click your profile icon → "Account"
4. **Enable 2FA**:
   - Click "Two-Factor Authentication"
   - Choose "Authorization and Publishing" (recommended) or "Authorization Only"
   - Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
   - Enter the 6-digit code to confirm

### Step 2: Publish with OTP

Once 2FA is enabled, publish using the `--otp` flag:

```bash
# Get 2FA code from your authenticator app
# Then run:
npm publish --access public --otp=123456
```

Replace `123456` with your actual 6-digit code from the authenticator app.

---

## Solution 2: Use Automation Token (For CI/CD)

If you're publishing from an automated environment, create an automation token:

### Step 1: Create Automation Token

1. **Go to NPM**: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. **Click "Generate New Token"**
3. **Select "Automation"** (bypasses 2FA)
4. **Copy the token** (you'll only see it once!)

### Step 2: Login with Token

```bash
npm login
# Username: YOUR_NPM_USERNAME
# Password: PASTE_YOUR_TOKEN_HERE
# Email: YOUR_EMAIL
```

OR set it as environment variable:

```bash
# Add to ~/.npmrc
//registry.npmjs.org/:_authToken=YOUR_TOKEN_HERE
```

### Step 3: Publish

```bash
npm publish --access public
```

---

## Solution 3: Quick Legacy Token (Temporary)

If you can't enable 2FA right now, you can create a legacy token:

```bash
# 1. Create token
npm token create

# 2. Login with token
npm login
# Use the token as password

# 3. Publish
npm publish --access public
```

---

## Recommended Workflow

**For regular use (most secure):**
```bash
# Enable 2FA once on npmjs.com
# Then every time you publish:
npm publish --access public --otp=$(node -e "console.log(prompt('Enter 2FA code:'))")
```

**Or create a simple script** in `package.json`:
```json
{
  "scripts": {
    "publish:npm": "npm publish --access public"
  }
}
```

Then run:
```bash
npm run publish:npm -- --otp=YOUR_CODE
```

---

## Fix Package Warnings

You also saw this warning:
```
npm warn publish "bin[gent]" script name was cleaned
```

Fix it by running:
```bash
npm pkg fix
```

This will automatically correct the package.json formatting.

---

## Complete Publishing Checklist

✅ **Before publishing:**

1. Enable 2FA on npmjs.com
2. Run `npm pkg fix` to fix package.json warnings
3. Test locally: `npm link`, then `gent --help`
4. Verify package contents: `npm pack --dry-run`

📦 **To publish:**

1. Get 2FA code from authenticator app
2. Run: `npm publish --access public --otp=YOUR_CODE`
3. Wait for confirmation
4. Test installation: `npm install -g gent-cli`

---

## Troubleshooting

### "Invalid OTP"
- Make sure you're using the latest code from your authenticator
- Code expires every 30 seconds

### "You do not have permission"
- Verify you're logged in: `npm whoami`
- Make sure the package name isn't taken
- Try a scoped package: `@yourusername/gent-cli`

### "Package name too similar"
- NPM prevents similar names
- Choose a different name or add your scope

---

## Quick Commands Reference

```bash
# Check current login
npm whoami

# Enable 2FA
npm profile enable-2fa auth-and-writes

# Publish with 2FA
npm publish --access public --otp=123456

# Create automation token
npm token create --read-only=false --cidr-whitelist=0.0.0.0/0

# Fix package.json
npm pkg fix

# Test package locally
npm link
```

---

**Next Steps:**
1. Enable 2FA at https://www.npmjs.com/settings/YOUR_USERNAME/tfa
2. Get your 6-digit code from authenticator app
3. Run: `npm publish --access public --otp=YOUR_CODE`

✨ That's it! Your package will be published!
