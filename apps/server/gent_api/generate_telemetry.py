#!/usr/bin/env python3
"""
Telemetry Data Generator for Grafana Demo
This script generates comprehensive telemetry data by exercising all API endpoints.
Perfect for demonstrating observability capabilities in exams/presentations.
"""

import requests
import time
import random
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
import sys

# Configuration
API_BASE_URL = "http://localhost:8000"
NUM_USERS = 20
NUM_REQUESTS_PER_USER = 5
CONCURRENT_WORKERS = 5

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text: str):
    """Print a colored header."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}\n")

def print_success(text: str):
    """Print success message."""
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")

def print_warning(text: str):
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠ {text}{Colors.RESET}")

def print_error(text: str):
    """Print error message."""
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")

def print_info(text: str):
    """Print info message."""
    print(f"{Colors.BLUE}ℹ {text}{Colors.RESET}")

class TelemetryGenerator:
    def __init__(self):
        self.stats = {
            'registrations_success': 0,
            'registrations_failed': 0,
            'logins_success': 0,
            'logins_failed': 0,
            'token_refreshes': 0,
            'logouts': 0,
            'repositories_created': 0,
            'commits_created': 0,
            'repositories_deleted': 0,
            'api_calls': 0,
            'errors': 0,
        }
        self.users = []
        self.tokens = []
        self.repositories = []

    def check_server(self) -> bool:
        """Check if Django server is running."""
        try:
            response = requests.get(f"{API_BASE_URL}/api/health/", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False

    def register_user(self, index: int) -> Dict[str, Any]:
        """Register a new user."""
        email = f"user{index}@example.com"
        password = f"TestPass123!@#{index}"

        try:
            response = requests.post(
                f"{API_BASE_URL}/api/auth/register/",
                json={"email": email, "password": password},
                timeout=10
            )

            if response.status_code in [200, 201]:
                self.stats['registrations_success'] += 1
                print_success(f"Registered user: {email}")
                return {"email": email, "password": password, "success": True}
            else:
                self.stats['registrations_failed'] += 1
                if response.status_code == 400:
                    print_warning(f"User {email} already exists (expected)")
                    return {"email": email, "password": password, "success": True}
                else:
                    print_error(f"Failed to register {email}: {response.status_code}")
                    return {"email": email, "password": password, "success": False}
        except Exception as e:
            self.stats['registrations_failed'] += 1
            print_error(f"Exception registering {email}: {e}")
            return {"email": email, "password": password, "success": False}

    def login_user(self, email: str, password: str) -> Dict[str, Any]:
        """Login a user and get tokens."""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/auth/login/",
                json={"email": email, "password": password},
                timeout=10
            )

            if response.status_code == 200:
                self.stats['logins_success'] += 1
                data = response.json()
                print_success(f"Logged in: {email}")
                return {
                    "access": data.get("access"),
                    "refresh": data.get("refresh"),
                    "email": email,
                    "success": True
                }
            else:
                self.stats['logins_failed'] += 1
                print_error(f"Failed to login {email}: {response.status_code}")
                return {"email": email, "success": False}
        except Exception as e:
            self.stats['logins_failed'] += 1
            print_error(f"Exception logging in {email}: {e}")
            return {"email": email, "success": False}

    def failed_login_attempts(self):
        """Generate failed login attempts for error metrics."""
        print_info("Generating failed login attempts...")

        for i in range(10):
            try:
                response = requests.post(
                    f"{API_BASE_URL}/api/auth/login/",
                    json={"email": f"nonexistent{i}@example.com", "password": "WrongPassword123!"},
                    timeout=5
                )
                self.stats['logins_failed'] += 1
                self.stats['errors'] += 1
            except:
                pass

        print_warning(f"Generated 10 failed login attempts")

    def refresh_token(self, refresh_token: str) -> bool:
        """Refresh an access token."""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/auth/token/refresh/",
                json={"refresh": refresh_token},
                timeout=10
            )

            if response.status_code == 200:
                self.stats['token_refreshes'] += 1
                return True
            else:
                return False
        except Exception:
            return False

    def logout_user(self, refresh_token: str) -> bool:
        """Logout a user (blacklist refresh token)."""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/auth/logout/",
                json={"refresh": refresh_token},
                timeout=10
            )

            if response.status_code in [200, 204, 205]:
                self.stats['logouts'] += 1
                return True
            else:
                return False
        except Exception:
            return False

    def make_authenticated_request(self, access_token: str, endpoint: str) -> bool:
        """Make an authenticated API request."""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.get(
                f"{API_BASE_URL}{endpoint}",
                headers=headers,
                timeout=10
            )
            self.stats['api_calls'] += 1

            if response.status_code >= 400:
                self.stats['errors'] += 1

            return response.status_code < 400
        except Exception:
            self.stats['errors'] += 1
            return False

    def create_repository(self, access_token: str, index: int) -> Dict[str, Any]:
        """Create a repository."""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.post(
                f"{API_BASE_URL}/api/repositories/",
                headers=headers,
                json={
                    "name": f"project-{index}",
                    "description": f"Test repository {index} for demo purposes",
                    "is_private": random.choice([True, False])
                },
                timeout=10
            )

            if response.status_code == 201:
                self.stats['repositories_created'] += 1
                repo_data = response.json()
                print_success(f"Created repository: {repo_data['name']}")
                return {"id": repo_data['id'], "name": repo_data['name'], "success": True}
            else:
                self.stats['errors'] += 1
                return {"success": False}
        except Exception as e:
            self.stats['errors'] += 1
            return {"success": False}

    def create_commit(self, access_token: str, repository_id: int, commit_index: int) -> bool:
        """Create a commit in a repository."""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            messages = [
                "Initial commit",
                "Add README",
                "Update dependencies",
                "Fix bug in authentication",
                "Implement new feature",
                "Refactor code structure",
                "Update documentation",
                "Add unit tests",
                "Improve performance",
                "Fix typo"
            ]

            response = requests.post(
                f"{API_BASE_URL}/api/repositories/{repository_id}/commits/",
                headers=headers,
                json={
                    "message": messages[commit_index % len(messages)],
                    "parent_hash": None
                },
                timeout=10
            )

            if response.status_code == 201:
                self.stats['commits_created'] += 1
                commit_data = response.json()
                print_success(f"Created commit: {commit_data['hash'][:7]}")
                return True
            else:
                self.stats['errors'] += 1
                return False
        except Exception:
            self.stats['errors'] += 1
            return False

    def delete_repository(self, access_token: str, repository_id: int) -> bool:
        """Delete a repository."""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.delete(
                f"{API_BASE_URL}/api/repositories/{repository_id}/",
                headers=headers,
                timeout=10
            )

            if response.status_code == 204:
                self.stats['repositories_deleted'] += 1
                return True
            else:
                return False
        except Exception:
            return False

    def user_workflow(self, index: int):
        """Complete user workflow: register, login, use API, create repos/commits, refresh, logout."""
        # Register
        user = self.register_user(index)
        if not user['success']:
            return

        time.sleep(random.uniform(0.1, 0.5))

        # Login
        token_data = self.login_user(user['email'], user['password'])
        if not token_data['success']:
            return

        time.sleep(random.uniform(0.1, 0.3))

        # Create repositories
        repositories = []
        for repo_index in range(random.randint(1, 3)):
            repo = self.create_repository(token_data['access'], index * 10 + repo_index)
            if repo['success']:
                repositories.append(repo)
                time.sleep(random.uniform(0.1, 0.3))

                # Create commits for this repository
                num_commits = random.randint(3, 8)
                for commit_index in range(num_commits):
                    self.create_commit(token_data['access'], repo['id'], commit_index)
                    time.sleep(random.uniform(0.05, 0.2))

        # List repositories
        self.make_authenticated_request(token_data['access'], '/api/repositories/')
        time.sleep(random.uniform(0.1, 0.2))

        # Make several API calls
        for _ in range(NUM_REQUESTS_PER_USER):
            # Check health
            self.make_authenticated_request(token_data['access'], '/api/health/')
            time.sleep(random.uniform(0.05, 0.2))

            # Get profile
            self.make_authenticated_request(token_data['access'], '/api/auth/profile/')
            time.sleep(random.uniform(0.05, 0.2))

        # Refresh token
        if self.refresh_token(token_data['refresh']):
            print_success(f"Refreshed token for {user['email']}")

        time.sleep(random.uniform(0.1, 0.3))

        # Delete some repositories
        if repositories and random.random() > 0.5:
            repo_to_delete = random.choice(repositories)
            if self.delete_repository(token_data['access'], repo_to_delete['id']):
                print_success(f"Deleted repository: {repo_to_delete['name']}")

        time.sleep(random.uniform(0.1, 0.3))

        # Logout
        if self.logout_user(token_data['refresh']):
            print_success(f"Logged out {user['email']}")

    def generate_load(self):
        """Generate concurrent load to create interesting traces."""
        print_header("Generating Concurrent Load")

        with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
            futures = [
                executor.submit(self.user_workflow, i)
                for i in range(NUM_USERS)
            ]

            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print_error(f"Workflow failed: {e}")

    def print_stats(self):
        """Print generation statistics."""
        print_header("Telemetry Generation Complete")

        print(f"{Colors.BOLD}Statistics:{Colors.RESET}")
        print(f"  Successful Registrations: {Colors.GREEN}{self.stats['registrations_success']}{Colors.RESET}")
        print(f"  Failed Registrations:     {Colors.RED}{self.stats['registrations_failed']}{Colors.RESET}")
        print(f"  Successful Logins:        {Colors.GREEN}{self.stats['logins_success']}{Colors.RESET}")
        print(f"  Failed Logins:            {Colors.RED}{self.stats['logins_failed']}{Colors.RESET}")
        print(f"  Token Refreshes:          {Colors.CYAN}{self.stats['token_refreshes']}{Colors.RESET}")
        print(f"  Logouts:                  {Colors.CYAN}{self.stats['logouts']}{Colors.RESET}")
        print(f"  Repositories Created:     {Colors.GREEN}{self.stats['repositories_created']}{Colors.RESET}")
        print(f"  Commits Created:          {Colors.GREEN}{self.stats['commits_created']}{Colors.RESET}")
        print(f"  Repositories Deleted:     {Colors.YELLOW}{self.stats['repositories_deleted']}{Colors.RESET}")
        print(f"  Total API Calls:          {Colors.BLUE}{self.stats['api_calls']}{Colors.RESET}")
        print(f"  Errors Generated:         {Colors.YELLOW}{self.stats['errors']}{Colors.RESET}")
        print()

    def run(self):
        """Run the telemetry generator."""
        print_header("Telemetry Data Generator for Grafana LGTM")

        # Check server
        print_info("Checking Django server...")
        if not self.check_server():
            print_error("Django server is not running!")
            print_info("Start it with: python manage.py runserver")
            sys.exit(1)
        print_success("Django server is running")

        # Generate failed logins first
        self.failed_login_attempts()
        time.sleep(1)

        # Generate load
        self.generate_load()

        # Print stats
        self.print_stats()

        # Print next steps
        print(f"{Colors.BOLD}Next Steps:{Colors.RESET}")
        print(f"1. Open Grafana: {Colors.CYAN}http://localhost:3000{Colors.RESET}")
        print(f"   Login: {Colors.YELLOW}admin / admin{Colors.RESET}")
        print()
        print(f"2. View Metrics (Prometheus):")
        print(f"   - Go to {Colors.BOLD}Explore{Colors.RESET} → Select {Colors.BOLD}Prometheus{Colors.RESET}")
        print(f"   - Try queries:")
        print(f"     • {Colors.GREEN}gent_user_registrations_total{Colors.RESET}")
        print(f"     • {Colors.GREEN}gent_user_logins_total{Colors.RESET}")
        print(f"     • {Colors.GREEN}rate(gent_user_logins_total[5m]){Colors.RESET}")
        print()
        print(f"3. View Traces (Tempo):")
        print(f"   - Go to {Colors.BOLD}Explore{Colors.RESET} → Select {Colors.BOLD}Tempo{Colors.RESET}")
        print(f"   - Search by service: {Colors.GREEN}gent-api{Colors.RESET}")
        print(f"   - Click on traces to see request flows")
        print()
        print(f"4. View Logs (Loki):")
        print(f"   - Go to {Colors.BOLD}Explore{Colors.RESET} → Select {Colors.BOLD}Loki{Colors.RESET}")
        print(f"   - Query: {Colors.GREEN}{{service_name=\"gent-api\"}}{Colors.RESET}")
        print()
        print(f"5. Create Dashboard:")
        print(f"   - Click {Colors.BOLD}Dashboards{Colors.RESET} → {Colors.BOLD}New{Colors.RESET} → {Colors.BOLD}New Dashboard{Colors.RESET}")
        print(f"   - Add panels with the queries above")
        print()


if __name__ == "__main__":
    generator = TelemetryGenerator()
    generator.run()
