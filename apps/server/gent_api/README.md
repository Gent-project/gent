# Gent API

A Django REST Framework API project for a Git-like CLI tool.

## Setup

### Prerequisites
- Python 3.13+
- Django 5.2.8
- Django REST Framework 3.16.1

### Installation

1. Create and activate a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run migrations:
```bash
python3 manage.py makemigrations
python3 manage.py migrate
```

4. Create a superuser (optional):
```bash
python3 manage.py createsuperuser
```

### Running the Server

```bash
python3 manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/`

**API Documentation:**
- Swagger UI: http://127.0.0.1:8000/api/docs/
- ReDoc: http://127.0.0.1:8000/api/redoc/

## API Endpoints

### Root
- `GET /api/` - API root with welcome message and endpoint list

### Authentication
All authentication endpoints use email/password authentication with JWT tokens.

- `POST /api/auth/register/` - Register a new user
- `POST /api/auth/login/` - Login and get JWT tokens
- `POST /api/auth/logout/` - Logout (blacklist refresh token)
- `GET /api/auth/profile/` - Get current user profile (requires authentication)
- `PUT /api/auth/profile/` - Update user profile (requires authentication)
- `PATCH /api/auth/profile/` - Partially update user profile (requires authentication)
- `POST /api/auth/token/refresh/` - Refresh access token

### API Documentation
- `GET /api/docs/` - Swagger UI (interactive API documentation)
- `GET /api/redoc/` - ReDoc (alternative API documentation)
- `GET /api/schema/` - OpenAPI schema (JSON/YAML)

### Admin
- `GET /admin/` - Django admin interface

## Authentication Examples

### Register a New User
```bash
curl -X POST http://127.0.0.1:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "password_confirm": "securepassword123",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

### Login
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

Response will include:
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "date_joined": "2024-01-01T00:00:00Z",
    "is_active": true
  },
  "tokens": {
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

### Get User Profile (Authenticated)
```bash
curl -X GET http://127.0.0.1:8000/api/auth/profile/ \
  -H "Authorization: Bearer <access_token>"
```

### Refresh Access Token
```bash
curl -X POST http://127.0.0.1:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh": "<refresh_token>"
  }'
```

### Logout
```bash
curl -X POST http://127.0.0.1:8000/api/auth/logout/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh": "<refresh_token>"
  }'
```

## Running Tests

To run the authentication API tests:

```bash
python3 manage.py test api.tests -v 2
```

All 23 tests should pass, covering:
- User registration (success, validation errors, duplicate email)
- User login (success, invalid credentials, inactive users)
- User profile (GET, PUT, PATCH with authentication)
- User logout (with token blacklisting)
- Token refresh (success, invalid tokens, blacklisted tokens)

## Project Structure

```
gent_api/
├── manage.py
├── gent_api/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
└── api/
    ├── __init__.py
    ├── models.py          # User model
    ├── serializers.py     # User serializers
    ├── views.py           # Authentication API views
    ├── urls.py            # API URL routing
    ├── tests.py           # Authentication API tests
    ├── admin.py
    ├── apps.py
    └── migrations/
```

## Features

- Email/password authentication with JWT tokens
- User registration and login
- User profile management
- Token refresh and logout
- Comprehensive test coverage (23 tests)
- Swagger/OpenAPI documentation
- Django REST Framework
- SQLite database (can be easily switched to PostgreSQL/MySQL)
