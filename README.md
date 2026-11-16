# UniGuide Cameroon Admin Panel

This is the admin dashboard for the UniGuide Cameroon project.

## 🔐 API Documentation

This section details the authentication endpoints used for Admin access.

### 1. Admin Signup (Register)
Creates a new admin account in the database. Passwords are automatically hashed before saving.

- **Endpoint:** `/api/auth/register`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body:**
```json
{
  "email": "admin@uniguide.cm",
  "password": "SecurePassword123"
}