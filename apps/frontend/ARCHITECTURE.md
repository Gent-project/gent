# Gent Platform - Architecture & Best Practices

## 📁 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── auth/                     # Authentication pages
│   │   ├── login/                # Login page
│   │   ├── signup/               # Signup page
│   │   └── reset-password/       # Password reset page
│   ├── dashboard/                # Dashboard pages
│   │   ├── _components/          # Dashboard-specific components
│   │   ├── repository/           # Repository pages
│   │   └── settings/             # Settings pages
│   ├── components/               # Shared components
│   └── api/                      # API routes (if any)
│
├── hooks/                        # Custom React hooks
│   ├── auth/                     # Auth hooks aggregator
│   ├── use-login.ts             # Login hook
│   ├── use-register.ts          # Register hook
│   ├── use-auth-profile.ts      # Profile management
│   ├── use-password-reset.ts    # Password reset
│   ├── use-password-change.ts   # Password change
│   ├── use-repositories.ts      # Repository CRUD
│   ├── use-branches.ts          # Branch operations
│   ├── use-commits.ts           # Commit operations
│   ├── use-tags.ts              # Tag operations
│   └── use-files.ts             # File operations
│
├── lib/                         # Utility libraries
│   ├── axios.ts                 # Axios instance with interceptors
│   └── auth-session.ts          # Auth session helpers
│
├── store/                       # Redux store
│   └── slices/                  # Redux slices
│       ├── auth-slice.ts        # Auth state
│       └── theme-slice.ts       # Theme state
│
├── types/                       # TypeScript types
│   ├── repository.ts            # Repository types
│   └── user.ts                  # User types
│
├── constant/                    # Constants
│   └── api-routes.tsx           # API route constants
│
└── services/                    # Service layer (optional)
    └── repository.service.ts    # Repository service
```

## 🔐 Authentication Flow

### 1. Login Flow

```
User → LoginPage → useLogin hook → axios POST /auth/login/
  ↓
Redux Store (setAuth) → localStorage (token)
  ↓
Redirect to Dashboard
```

### 2. Token Refresh Flow

```
API Request → 401 Error → axios interceptor
  ↓
POST /auth/token/refresh/ with refreshToken
  ↓
New token → Update localStorage → Retry original request
```

### 3. Password Reset Flow

```
User clicks "Forgot Password" → ForgotPasswordModal
  ↓
POST /auth/password/reset/ with email
  ↓
User receives email with uid & token
  ↓
User clicks link → /auth/reset-password?uid=xxx&token=yyy
  ↓
POST /auth/password/reset/confirm/ with new password
  ↓
Success → Redirect to login
```

## 📡 API Integration

### API Routes Structure

All API routes are defined in `src/constant/api-routes.tsx`:

```typescript
const API_ROUTES = {
  AUTH: {
    LOGIN: "auth/login/",
    LOGOUT: "auth/logout/",
    REGISTER: "auth/register/",
    PROFILE: "auth/profile/",
    TOKEN_REFRESH: "auth/token/refresh/",
    PASSWORD_CHANGE: "auth/password/change/",
    PASSWORD_RESET: "auth/password/reset/",
    PASSWORD_RESET_CONFIRM: "auth/password/reset/confirm/",
  },
  REPOS: {
    LIST: "repos/",
    CREATE: "repos/create/",
    // ... etc
  },
};
```

### Custom Hooks Pattern

Each API endpoint has a corresponding custom hook:

```typescript
// Example: use-login.ts
export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials) => {
      const response = await axios.post(API_ROUTES.AUTH.LOGIN, credentials);
      return response.data;
    },
  });
};
```

## 🎯 Best Practices Implemented

### 1. **Separation of Concerns**

- UI Components in `app/`
- Business logic in `hooks/`
- State management in `store/`
- Types in `types/`
- Constants in `constant/`

### 2. **Type Safety**

- All API responses have TypeScript interfaces
- Props are strictly typed
- No `any` types in production code

### 3. **Error Handling**

- Axios interceptors handle global errors
- Token refresh is automatic
- User-friendly error messages with toast notifications

### 4. **Security**

- JWT tokens stored in localStorage
- Automatic token refresh before expiry
- Protected routes with auth guards
- CSRF protection (if needed)

### 5. **Code Organization**

- One component per file
- Hooks follow naming convention `use-*`
- Constants in SCREAMING_SNAKE_CASE
- Components in PascalCase

### 6. **Performance**

- React Query for data fetching & caching
- Optimistic updates where applicable
- Lazy loading for routes
- Code splitting

## 🔄 State Management

### Redux Slices

1. **auth-slice**: User authentication state
2. **theme-slice**: UI theme preferences

### React Query

Used for server state management:

- Automatic caching
- Background refetching
- Optimistic updates
- Error retries

## 🎨 UI/UX Patterns

### Theme System

- Dark/Light mode support
- Theme state persisted in Redux
- CSS variables for colors
- Smooth transitions

### Loading States

- Skeleton loaders for data fetching
- Button disabled states during mutations
- Loading spinners for long operations

### Error States

- Toast notifications for errors
- Inline validation messages
- Empty states for no data

## 🚀 Deployment Checklist

- [ ] Environment variables set
- [ ] API base URL configured
- [ ] Error tracking enabled (Sentry)
- [ ] Analytics configured
- [ ] SEO meta tags added
- [ ] Performance monitoring
- [ ] Security headers configured

## 📝 Code Style

### Naming Conventions

- Components: `PascalCase`
- Hooks: `camelCase` with `use` prefix
- Constants: `SCREAMING_SNAKE_CASE`
- Files: `kebab-case` or `PascalCase` for components

### Import Order

1. React imports
2. Third-party libraries
3. Internal hooks
4. Internal components
5. Types
6. Constants
7. Styles

### Component Structure

```typescript
// 1. Imports
// 2. Types/Interfaces
// 3. Component definition
// 4. State & hooks
// 5. Handlers
// 6. Effects
// 7. Render helpers
// 8. Return JSX
```

## 🧪 Testing Strategy (Future)

- Unit tests for hooks
- Integration tests for API calls
- E2E tests for critical flows
- Component tests with React Testing Library

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
