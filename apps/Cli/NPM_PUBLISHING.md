# Publishing Gent CLI to NPM

## Quick Guide

This guide will help you publish the `gent-cli` package to npm.

## Prerequisites

1. **NPM Account**: Create one at [npmjs.com](https://www.npmjs.com/signup)
2. **Login to NPM**:
   ```bash
   npm login
   # Enter your username, password, and email
   ```

## Before Publishing

### 1. Update Version Number

Edit `package.json` and increment the version:
```bash
# Current: 1.1.0
# Next patch: 1.1.1
# Next minor: 1.2.0
# Next major: 2.0.0
```

Use npm version command:
```bash
npm version patch  # For bug fixes: 1.1.0 -> 1.1.1
npm version minor  # For new features: 1.1.0 -> 1.2.0
npm version major  # For breaking changes: 1.1.0 -> 2.0.0
```

### 2. Test Locally

```bash
# Install dependencies
npm install

# Test the CLI
gent --help
gent register
gent login
gent whoami
```

### 3. Verify Package Contents

```bash
npm pack --dry-run
```

This shows what will be included in the published package.

## Publishing

### Option 1: Public Package (Recommended)

```bash
npm publish --access public
```

###  Option 2: Scoped Package

If you want to publish under your username:

1. Update `package.json` name to `@yourusername/gent-cli`
2. Publish:
   ```bash
   npm publish --access public
   ```

## After Publishing

### 1. Verify Installation

```bash
npm install -g gent-cli
gent --help
```

### 2. Update GitHub

```bash
git add .
git commit -m "Release v1.1.0 - Add authentication features"
git tag v1.1.0
git push origin main --tags
```

### 3. Create GitHub Release

- Go to GitHub repository
- Click "Releases" → "Create a new release"
- Choose tag `v1.1.0`
- Add release notes

## Version Updates

When releasing new versions:

```bash
# 1. Make changes
# 2. Update version
npm version patch  # or minor/major

# 3. Publish
npm publish --access public

# 4. Push  to GitHub
git push origin main --tags
```

## Troubleshooting

### Package Name Taken

If `gent-cli` is already taken on npm:

1. Choose a different name (e.g., `@yourusername/gent-cli` or `gent-version-control`)
2. Update `package.json` name field
3. Publish again

### Authentication Errors

```bash
npm logout
npm login
npm publish --access public
```

### Files Not Included

Check the `files` field in `package.json`:
```json
"files": [
  "src/",
  "README.md",
  "QUICKSTART.md"
]
```

## Useful Commands

```bash
# View package info
npm view gent-cli

# Unpublish (within 72 hours)
npm unpublish gent-cli@1.1.0

# Deprecate a version
npm deprecate gent-cli@1.0.0 "Please upgrade to 1.1.0"
```

## Current Package Info

- **Name**: `gent-cli`
- **Version**: `1.1.0`
- **Description**: A Git-like version control CLI tool with cloud authentication
- **Author**: Abdalrahman Kanawati
- **Repository**: https://github.com/SaadShaya7/gent

## What's Included

The published package includes:
- All source code (`src/` directory)
- README.md documentation
- QUICKSTART.md guide
- All dependencies automatically installed

Users can install with:
```bash
npm install -g gent-cli
```

Then use:
```bash
gent register  # Create account
gent login     # Login
gent whoami    # View profile
gent init      # Initialize repo
```

---

**Ready to publish?** Run `npm publish --access public` from the `/apps/Cli` directory!
