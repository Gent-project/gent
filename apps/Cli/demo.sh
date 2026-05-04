#!/bin/bash

# Gent CLI Demo Script
# This script demonstrates the basic usage of Gent CLI

echo "=========================================="
echo "🚀 Gent CLI Demo"
echo "=========================================="
echo ""

# Create a temporary test directory
TEST_DIR="gent-demo-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "📁 Created test directory: $TEST_DIR"
echo ""

# 1. Initialize repository
echo "1️⃣ Initializing Gent repository..."
node ../src/index.js init -y
echo ""

# 2. Create some test files
echo "2️⃣ Creating test files..."
echo "console.log('Hello, Gent!');" > app.js
echo "# My Project" > README.md
echo "node_modules/" > .gitignore
echo "✓ Created: app.js, README.md, .gitignore"
echo ""

# 3. Check status
echo "3️⃣ Checking status..."
node ../src/index.js status
echo ""

# 4. Add files
echo "4️⃣ Adding files to staging..."
node ../src/index.js add app.js README.md
echo ""

# 5. Check status again
echo "5️⃣ Checking status after staging..."
node ../src/index.js status
echo ""

# 6. Commit
echo "6️⃣ Creating first commit..."
node ../src/index.js commit -m "Initial commit: Add app.js and README"
echo ""

# 7. Create a feature branch
echo "7️⃣ Creating feature branch..."
node ../src/index.js branch feature-login
echo ""

# 8. Switch to feature branch
echo "8️⃣ Switching to feature branch..."
node ../src/index.js checkout feature-login
echo ""

# 9. Make changes
echo "9️⃣ Making changes in feature branch..."
echo "// Login function" >> app.js
node ../src/index.js add app.js
node ../src/index.js commit -m "Add login functionality"
echo ""

# 10. View commit log
echo "🔟 Viewing commit history..."
node ../src/index.js log
echo ""

# 11. List branches
echo "1️⃣1️⃣ Listing all branches..."
node ../src/index.js branch
echo ""

# 12. Switch back to main
echo "1️⃣2️⃣ Switching back to main branch..."
node ../src/index.js checkout main
echo ""

# 13. Final status
echo "1️⃣3️⃣ Final status check..."
node ../src/index.js status
echo ""

echo "=========================================="
echo "✅ Demo completed successfully!"
echo "=========================================="
echo ""
echo "Test directory: $(pwd)"
echo "To explore: cd $TEST_DIR"
echo "To cleanup: cd .. && rm -rf $TEST_DIR"
