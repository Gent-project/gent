# Git API Considerations

This document outlines important considerations for building a Git-like API for a CLI tool.

## 1. Authentication & Authorization

### Current Implementation
- ✅ Email/password authentication with JWT tokens
- ✅ Token-based authentication suitable for CLI tools
- ✅ Token refresh mechanism for long-running CLI sessions

### Additional Considerations

#### SSH Key Authentication
For a Git-like CLI, you may want to support SSH key authentication similar to GitHub/GitLab:
- Store SSH public keys in the user model
- Validate SSH signatures for authentication
- This is more secure and convenient for CLI tools

#### Personal Access Tokens (PATs)
Consider implementing Personal Access Tokens:
- Long-lived tokens with specific scopes/permissions
- Users can create multiple tokens for different purposes
- Better for automation and CI/CD integration
- Tokens can be revoked individually

#### OAuth2 Support
For third-party integrations:
- OAuth2 flows for CLI tools
- Device flow for CLI authentication
- Refresh token rotation

## 2. Repository Management

### Core Models Needed
1. **Repository Model**
   - Name, description, visibility (public/private)
   - Owner (user or organization)
   - Default branch
   - Created/updated timestamps
   - Size limits

2. **Branch Model**
   - Repository reference
   - Branch name
   - Latest commit SHA
   - Protection rules

3. **Commit Model**
   - Repository reference
   - SHA hash
   - Author, committer
   - Message, timestamp
   - Parent commits
   - Tree SHA

4. **Tree/Blob Models**
   - File contents (blobs)
   - Directory structure (trees)
   - SHA-based content addressing

### API Endpoints to Consider
```
GET    /api/repos/                    # List repositories
POST   /api/repos/                    # Create repository
GET    /api/repos/{owner}/{repo}/     # Get repository
PATCH  /api/repos/{owner}/{repo}/     # Update repository
DELETE /api/repos/{owner}/{repo}/     # Delete repository

GET    /api/repos/{owner}/{repo}/branches/     # List branches
GET    /api/repos/{owner}/{repo}/commits/      # List commits
GET    /api/repos/{owner}/{repo}/commits/{sha} # Get commit
POST   /api/repos/{owner}/{repo}/commits/      # Create commit

GET    /api/repos/{owner}/{repo}/tree/{sha}    # Get tree
GET    /api/repos/{owner}/{repo}/blob/{sha}    # Get blob
```

## 3. Content Storage

### Storage Backend Options

1. **Database Storage (Current)**
   - Pros: Simple, transactional
   - Cons: Not efficient for large files, database bloat
   - Use for: Metadata, small files

2. **File System Storage**
   - Pros: Simple, direct access
   - Cons: Backup complexity, scaling issues
   - Use for: Development, small deployments

3. **Object Storage (S3, MinIO, etc.)**
   - Pros: Scalable, cost-effective, CDN integration
   - Cons: Additional complexity, vendor lock-in
   - Use for: Production, large files

4. **Git Backend (libgit2, dulwich)**
   - Pros: Native Git support, efficient
   - Cons: Complex, requires Git knowledge
   - Use for: Full Git compatibility

### Recommendation
- Use database for metadata (repos, commits, branches)
- Use object storage or file system for actual file contents
- Consider using `dulwich` (pure Python Git library) for Git operations

## 4. Performance Considerations

### Caching Strategy
- Cache repository metadata
- Cache commit history (with TTL)
- Cache file trees
- Use Redis for distributed caching

### Pagination
- All list endpoints should support pagination
- Use cursor-based pagination for large datasets
- Set reasonable default page sizes

### Rate Limiting
- Implement rate limiting per user/IP
- Different limits for authenticated vs anonymous
- Consider Git's push/pull patterns (burst traffic)

### Compression
- Compress large responses (gzip)
- Support content negotiation
- Compress stored blobs

## 5. Security Considerations

### Access Control
- Repository-level permissions (read/write/admin)
- Organization/team-based permissions
- Branch protection rules
- File-level access control (if needed)

### Input Validation
- Validate all user inputs
- Sanitize file paths
- Prevent path traversal attacks
- Validate commit messages and metadata

### Content Security
- Scan for sensitive data (API keys, passwords)
- Virus scanning for uploads
- Size limits on files/commits
- Prevent DoS through large uploads

### API Security
- HTTPS only in production
- CORS configuration (currently open - tighten for production)
- CSRF protection for web endpoints
- Rate limiting to prevent abuse

## 6. Git Protocol Support

### Smart HTTP Protocol
Git uses Smart HTTP for push/pull operations:
- `GET /{repo}.git/info/refs?service=git-upload-pack` (fetch)
- `POST /{repo}.git/git-upload-pack` (fetch)
- `POST /{repo}.git/git-receive-pack` (push)

### Implementation Options
1. **Use dulwich** (Python Git library)
   - Handles Git protocol
   - Pure Python, no C dependencies
   - Good for API-based Git

2. **Use libgit2 via pygit2**
   - More performant
   - C library, requires compilation
   - Better for high-performance scenarios

3. **Proxy to Git daemon**
   - Run actual Git server
   - Most compatible
   - More complex deployment

### Recommendation
Start with dulwich for simplicity, migrate to libgit2 if performance becomes an issue.

## 7. CLI Integration Patterns

### Authentication Flow
1. User runs CLI command
2. CLI checks for stored token
3. If no token or expired, prompt for login
4. Store token securely (keychain/credential store)
5. Use token for all API requests

### Token Storage
- Use platform-specific secure storage:
  - macOS: Keychain
  - Linux: libsecret
  - Windows: Credential Manager
- Never store tokens in plain text files

### Error Handling
- Clear error messages for CLI
- Handle network errors gracefully
- Provide retry logic
- Show helpful messages for auth failures

## 8. Data Models to Add

### Immediate Next Steps
```python
class Repository(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    is_private = models.BooleanField(default=False)
    default_branch = models.CharField(max_length=255, default='main')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['owner', 'name']

class Branch(models.Model):
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    latest_commit_sha = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['repository', 'name']

class Commit(models.Model):
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    sha = models.CharField(max_length=40, unique=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    tree_sha = models.CharField(max_length=40)
    parent_shas = models.JSONField(default=list)  # Array of parent commit SHAs
    created_at = models.DateTimeField()
```

## 9. Testing Strategy

### Unit Tests
- Test authentication flows
- Test repository CRUD operations
- Test permission checks

### Integration Tests
- Test Git operations (push/pull)
- Test concurrent access
- Test large file handling

### CLI Integration Tests
- Test actual CLI commands
- Test token refresh flow
- Test error scenarios

## 10. Deployment Considerations

### Database
- SQLite is fine for development
- Use PostgreSQL for production
- Consider read replicas for scaling

### Storage
- Start with file system or object storage
- Plan for backup strategy
- Consider geographic distribution

### Monitoring
- Log all API requests
- Monitor authentication failures
- Track repository sizes
- Monitor performance metrics

### Backup & Recovery
- Regular database backups
- Repository content backups
- Test recovery procedures
- Version control for configuration

## 11. Migration Path

### Phase 1: Core Authentication (✅ Current)
- User registration/login
- JWT token management
- User profiles

### Phase 2: Repository Management
- Repository CRUD
- Basic permissions
- Branch management

### Phase 3: Git Operations
- Commit storage
- Tree/blob management
- Smart HTTP protocol

### Phase 4: Advanced Features
- Pull requests
- Issues
- Webhooks
- CI/CD integration

## 12. Recommended Next Steps

1. **Install additional packages:**
   ```bash
   pip install dulwich  # For Git operations
   pip install psycopg2-binary  # For PostgreSQL (when ready)
   ```

2. **Create Repository model and migrations**

3. **Implement repository API endpoints**

4. **Add permission system**

5. **Implement basic Git operations (commit, tree, blob)**

6. **Add Smart HTTP protocol support**

7. **Implement CLI client library**

## Questions to Consider

1. **Do you need full Git compatibility?**
   - If yes, use dulwich/libgit2
   - If no, simpler custom format may work

2. **What's your scale target?**
   - Small team: File system storage
   - Large scale: Object storage + CDN

3. **Do you need web UI?**
   - If yes, consider additional endpoints for web
   - CLI-first is simpler

4. **Organization/team support?**
   - Add organization model
   - Team-based permissions

5. **Public vs Private repos?**
   - Current model supports both
   - Consider public repo discovery
