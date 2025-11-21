# Setup Instructions

## Initial Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create migrations for the custom User model:**
   ```bash
   python3 manage.py makemigrations
   ```

3. **Apply migrations:**
   ```bash
   python3 manage.py migrate
   ```

4. **Create a superuser (optional):**
   ```bash
   python3 manage.py createsuperuser
   ```
   Note: You'll be prompted for email and password (not username).

5. **Run the development server:**
   ```bash
   python3 manage.py runserver
   ```

## Important Notes

### Custom User Model
- The project uses a **custom User model** with email as the username field
- If you had existing migrations, you may need to delete them and start fresh:
  ```bash
  # Only if you have existing migrations you want to reset
  rm -rf api/migrations/0*.py
  python3 manage.py makemigrations
  python3 manage.py migrate
  ```

### Database Reset
If you need to reset the database completely:
```bash
rm db.sqlite3
python3 manage.py migrate
python3 manage.py createsuperuser
```

## Testing the API

### 1. Register a new user:
```bash
curl -X POST http://127.0.0.1:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "password_confirm": "testpassword123",
    "first_name": "Test",
    "last_name": "User"
  }'
```

### 2. Login:
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

Save the `access` token from the response.

### 3. Get your profile:
```bash
curl -X GET http://127.0.0.1:8000/api/auth/profile/ \
  -H "Authorization: Bearer <your_access_token>"
```

## Troubleshooting

### Import Errors
If you get import errors for `rest_framework_simplejwt` or `corsheaders`:
- Make sure you've installed all dependencies: `pip install -r requirements.txt`

### Migration Errors
If you get errors about the User model:
- Make sure `AUTH_USER_MODEL = 'api.User'` is set in `settings.py`
- Delete existing migrations and recreate them (see above)

### CORS Errors
CORS is currently configured to allow all origins for CLI access. For production:
- Set `CORS_ALLOW_ALL_ORIGINS = False` in `settings.py`
- Configure `CORS_ALLOWED_ORIGINS` with specific domains
