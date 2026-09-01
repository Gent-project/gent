# File Upload Guide - Gent Platform

## Overview

This guide explains how to create and upload files to Gent repositories using the Web UI and Gent CLI.

## Method 1: Web UI Upload

### Prerequisites

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

The Web UI uses the Gent Push API with backend-compatible object hashing:

1. Calculates the blob SHA-256 for file content
2. Builds a tree object with all files
3. Creates a commit object
4. Pushes the complete Gent pack to the backend

---

## Method 2: Gent CLI

### For empty repositories:

```bash
# Step 1: Initialize local Gent repository
echo "# my-repo" >> README.md
gent init

# Step 2: Add and commit files
gent add README.md
gent commit -m "Initial commit"

# Step 3: Set up remote and push
gent remote add origin https://gent-api.onrender.com/api/repos/1/repo-name
gent push origin main
```

### For repositories with commits:

```bash
# Step 1: Clone the repository
gent clone https://gent-api.onrender.com/api/repos/1/repo-name
cd repo-name

# Step 2: Add your files
cp /path/to/your/files/* .
gent add .

# Step 3: Commit and push
gent commit -m "Add new files"
gent push origin main
```

---

## Troubleshooting

### "Repository is empty" message

**Solution**: Click New file in the Code tab, upload files, or use the Gent CLI flow above.

### "Blob hash mismatch" error

**Issue**: Blob hash calculation mismatch
**Solution**:

- Ensure file content is properly encoded
- Check for special characters
- Try using Gent CLI instead

### "Cannot create tags/branches in empty repository"

**Solution**: Push at least one commit first using Gent CLI

### Upload button not responding

**Check**:

- Browser console for errors
- Network tab for API responses
- Repository has at least one commit

---

## Technical Details

### Gent Object Hashing

Files are hashed with SHA-256 over the Gent blob object format:

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

1. **Use Gent CLI for**:
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
