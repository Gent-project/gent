#!/usr/bin/env python3
"""Quick test script for repository creation"""

import requests
import json

API_BASE = "http://localhost:8000"

# Register user
print("1. Registering user...")
response = requests.post(
    f"{API_BASE}/api/auth/register/",
    json={
        "email": "testuser@example.com",
        "password": "TestPass123!@#",
        "password_confirm": "TestPass123!@#"
    }
)
print(f"Status: {response.status_code}")
if response.status_code in [200, 201]:
    data = response.json()
    access_token = data['tokens']['access']
    print(f"Access token: {access_token[:20]}...")
elif response.status_code == 400:
    # User already exists, try login
    print("User exists, logging in...")
    response = requests.post(
        f"{API_BASE}/api/auth/login/",
        json={
            "email": "testuser@example.com",
            "password": "TestPass123!@#"
        }
    )
    if response.status_code == 200:
        data = response.json()
        access_token = data['tokens']['access']
        print(f"Access token: {access_token[:20]}...")
    else:
        print(f"Login failed: {response.status_code}")
        print(response.text)
        exit(1)
else:
    print(f"Registration failed: {response.text}")
    exit(1)

# Create repository
print("\n2. Creating repository...")
response = requests.post(
    f"{API_BASE}/api/repositories/",
    headers={"Authorization": f"Bearer {access_token}"},
    json={
        "name": "test-repo",
        "description": "Test repository",
        "is_private": False
    }
)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code == 201:
    repo = response.json()
    repo_id = repo['id']
    print(f"Created repository: {repo['name']} (ID: {repo_id})")

    # Create commit
    print("\n3. Creating commit...")
    response = requests.post(
        f"{API_BASE}/api/repositories/{repo_id}/commits/",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "message": "Initial commit"
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code == 201:
        commit = response.json()
        print(f"Created commit: {commit['hash'][:7]}")
else:
    print("Failed to create repository")
    print(f"Error: {response.text}")

# List repositories
print("\n4. Listing repositories...")
response = requests.get(
    f"{API_BASE}/api/repositories/",
    headers={"Authorization": f"Bearer {access_token}"}
)
print(f"Status: {response.status_code}")
repos = response.json()
print(f"Found {len(repos)} repositories")
for repo in repos:
    print(f"  - {repo['name']} (commits: {repo['commit_count']})")
