# Velvet Scoop API

A TypeScript Express application for user management and authentication, using MongoDB and Mongoose.

## Project Structure

```
website-v2/
├── src/
│   ├── controllers/
│   │   ├── index.ts
│   │   └── userController.ts
│   ├── dtos/
│   │   ├── index.ts
│   │   └── user.dto.ts
│   ├── models/
│   │   ├── index.ts
│   │   └── User.ts
│   ├── routes/
│   │   └── user.ts
│   ├── services/
│   │   └── db.ts
│   └── test/
│       ├── setup.ts
│       ├── mongoMemoryServer.ts
│       ├── e2e/
│       │   └── user.e2e.test.ts
│       └── user.test.ts
├── openapi.json
├── package.json
├── tsconfig.json
└── README.md
```

## Features
- User registration, login, and logout
- Password hashing with bcryptjs
- DTOs for request/response validation
- Session management with MongoDB TTL
- JWT token returned and set as cookie on login
- Authentication middleware for private routes
- MongoDB in-memory server for testing
- E2E and unit tests with Jest and Supertest
- OpenAPI v3 spec in JSON format

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run tests:
   ```bash
   npm test
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

## API Documentation
See `openapi.json` for the full API specification.

### Logout Endpoint
`POST /api/user/logout` (private)
- Requires authentication (JWT cookie or header)
- Destroys session and clears cookies
- Returns `{ message: 'Logged out successfully' }` on success


### Login Response
On successful login:
- Response includes all user fields except password
- `session`: The session identifier
- `jwt`: JWT token for authentication
- Both `session` and `jwt` are set as HTTP-only cookies

### Logout Test
Logout is covered by E2E tests:
- Registers and logs in a user
- Calls `/api/user/logout` with cookies
- Expects session destruction and cookies cleared


### Message Endpoints

#### Send Message (User)
`POST /api/messages/send` (private)
- Body: `{ recipientId: string, content: string }`
- Returns: MessageResponse

#### Get My Messages (User)
`GET /api/messages/my` (private)
- Returns: Array of MessageResponse (sent/received, not deleted)
- Marks unread messages as read

#### Send Message (Admin)
`POST /api/messages/admin/send` (admin)
- Body: `{ recipientId: string, content: string }`
- Returns: MessageResponse

#### Get All Messages (Admin)
`GET /api/messages/admin/all` (admin)
- Returns: Array of MessageResponse

#### Delete Message (Admin)
`DELETE /api/messages/admin/:id` (admin)
- Returns: MessageResponse or 404 if not found

### Message Model
- `sender`: User ID
- `recipient`: User ID
- `content`: string
- `read`: boolean
- `readAt`: Date
- `readBy`: User ID
- `deleted`: boolean
- `deletedBy`: User ID
- `deletedAt`: Date
- `createdAt`: Date

### Message DTOs
- `CreateMessageRequest`: `{ recipientId, content }`
- `MessageResponse`: All model fields except password

