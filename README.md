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

**Response:** `{ "message": "Login successful", "admin": { "id", "name", "email", "role" } }`

Login starts a server-side session (stored in MongoDB, `sessions` collection) and sets an httpOnly `uniguide.sid` cookie. The frontend must send requests with `credentials: 'include'`.

### 3. Current user
- **Endpoint:** `/api/auth/me` · **Method:** `GET`
- Returns `{ "admin": { ... } }` if the session is valid, otherwise `401`.

### 4. Logout
- **Endpoint:** `/api/auth/logout` · **Method:** `POST`
- Destroys the session on the server and clears the cookie.

### 5. Delete own account
- **Endpoint:** `/api/auth/me` · **Method:** `DELETE` · requires a logged-in session
- **Body:** `{ "password": "..." }` to confirm
- Deletes the account and ends the session. `400` if the password is wrong. Sessions on other devices stop working on their next request.

### Environment
Copy `backend/.env.example` to `backend/.env`. `SESSION_SECRET` is required; `CLIENT_URL` lists the frontend addresses allowed to send the cookie.

Accounts created before names were added have no `name`; the frontend shows their email instead.
