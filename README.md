# UniGuide Cameroon Admin Panel

This is the admin dashboard for the UniGuide Cameroon project.

## 🔐 API Documentation

This section details the authentication endpoints used for Admin access.

### 1. Admin Signup (Register)
Creates a new admin account in the database. Passwords are automatically hashed before saving.

- **Endpoint:** `/api/auth/register`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body:** (`name` is required)
```json
{
  "name": "Jane Doe",
  "email": "admin@uniguide.cm",
  "password": "SecurePassword123"
}
```

### 2. Login
Checks the email and password and returns the account details.

- **Endpoint:** `/api/auth/login`
- **Method:** `POST`

**Request Body:**
```json
{
  "email": "admin@uniguide.cm",
  "password": "SecurePassword123"
}
```

**Response:** `{ "message": "Login successful", "token": "...", "admin": { "id", "name", "email", "role" } }`

Accounts created before names were added have no `name`; the frontend shows their email instead.
