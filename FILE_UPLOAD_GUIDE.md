# File Upload Guide - Gent Platform

## Overview

This guide explains how to upload files to your Gent repositories using both the Web UI and Git CLI.

## Method 1: Web UI Upload (After Initial Commit)

### Prerequisites

- Repository must have at least one commit
- You need to be the repository owner or have write access

### Steps:

1. **Navigate to your repository**
   - Go to Dashboard → Select your repository
   - Click on the "Code" tab

2. **Upload files**
   - Click the "Upload" button (top right)
   - Or click "New file" to create a single file

3. **Fill in the form**:
   - **File name**: Enter the file name (e.g., `README.md`)
   - **Content**: Paste or type the file content
   - **Author name**: Your name (for the commit)
   - **Commit message**: Describe what you're adding

4. **Submit**
   - Click "Create file" or "Upload files"
   - Wait for success message
   - Files will appear in the repository

### How it works:

The Web UI uses the Git Push API with proper SHA-1 hashing:

1. Calculates blob SHA for file content
2. Builds a tree object with all files
3. Creates a commit object
4. Pushes the complete Git pack to the backend

---

## Method 2: Git CLI (Recommended for Initial Commit)

### For empty repositories:

```bash
# Step 1: Initialize local repository
echo "# my-repo" >> README.md
git init

# Step 2: Add and commit files
git add README.md
git commit -m "Initial commit"

# Step 3: Set up remote and push
git branch -M main
git remote add origin https://gent.dev/username/repo-name.git
git push -u origin main
```

### For repositories with commits:

```bash
# Step 1: Clone the repository
git clone https://gent.dev/username/repo-name.git
cd repo-name

# Step 2: Add your files
cp /path/to/your/files/* .
git add .

# Step 3: Commit and push
git commit -m "Add new files"
git push origin main
```

---

## Troubleshooting

### "Repository is empty" message

**Solution**: Use Git CLI to create the initial commit first (see Method 2 above)

### "Blob hash mismatch" error

**Issue**: SHA-1 calculation mismatch
**Solution**:

- Ensure file content is properly encoded
- Check for special characters
- Try using Git CLI instead

### "Cannot create tags/branches in empty repository"

**Solution**: Push at least one commit first using Git CLI

### Upload button not responding

**Check**:

- Browser console for errors
- Network tab for API responses
- Repository has at least one commit

---

## Technical Details

### Git SHA-1 Hashing

Files are hashed using Git's standard format:

```
blob <size>\0<content>
```

### Tree Structure

```
tree <size>\0<mode> <name>\0<sha_binary>...
```

### Commit Format

```
commit <size>\0
tree <tree_sha>
parent <parent_sha>
author Name <email> <timestamp>
committer Name <email> <timestamp>

<commit message>
```

---

## Best Practices

1. **Use Git CLI for**:
   - Initial repository setup
   - Large file uploads
   - Complex directory structures
   - Binary files

2. **Use Web UI for**:
   - Quick single file edits
   - Small text files
   - README updates
   - Configuration files

3. **Always**:
   - Write descriptive commit messages
   - Test locally before pushing
   - Review changes before committing

---

## API Endpoints Used

- `POST /repos/{owner_id}/{repo_name}/push/` - Main upload endpoint
- `GET /repos/{owner_id}/{repo_name}/commits/` - Get commit history
- `GET /repos/{owner_id}/{repo_name}/tree/{sha}/` - Get file tree

---

## Support

For issues or questions:

- Check browser console for error messages
- Review this guide
- Contact repository administrator
