# Users Management - Quick Start Guide

## 🚀 Getting Started

### 1. Start the Applications

```bash
# Terminal 1: Start Backend
cd apps/backend
pnpm dev

# Terminal 2: Start Admin App
cd apps/admin-app
pnpm dev
```

### 2. Login to Admin Dashboard

- Navigate to: `http://localhost:3002`
- Login with admin credentials:
  - Email: `admin@dculus.com`
  - Password: `admin123!@#`

---

## 📋 Features Overview

### Users Page (`/users`)

**What you'll see**:
- Search bar at the top
- Total users count card
- Grid of user cards (3 columns on desktop)
- Pagination controls at bottom

**What you can do**:
- **Search**: Type in the search bar to filter users by name or email
- **View Organizations**: Click "View Org →" next to any organization
- **View Details**: Click "View Details" button to see full user profile
- **Navigate**: Use Previous/Next buttons to browse pages

---

### User Detail Page (`/users/:userId`)

**What you'll see**:
- Large user avatar and profile
- Email verification status badge
- Account information (ID, created date, updated date)
- List of all organizations user belongs to

**What you can do**:
- **Back Navigation**: Click "← Back to Users"
- **View Organization**: Click "View Details" on any organization card
- **Navigate to Org**: Redirects to organization detail page

---

### Organization Detail Page (`/organizations/:orgId`)

**What you'll see**:
- Organization header (logo, name, slug)
- Statistics cards (members, forms, responses)
- Organization information section
- List of all members with roles

**What you can do**:
- **Back Navigation**: Click "← Back to Organizations"
- **View User**: Click "View User →" on any member card
- **Navigate to User**: Redirects to user detail page

---

## 🧭 Navigation Flow Examples

### Example 1: User → Organization → User
1. Go to `/users`
2. Click "View Details" on John Doe
3. Click "View Details" on Acme Corp
4. Click "View User" on Jane Smith
5. You're now viewing Jane's profile

### Example 2: Organization → User → Organization
1. Go to `/organizations`
2. Click "View Details" on TechCo
3. Click "View User" on Bob Smith
4. Click "View Details" on another organization
5. You're now viewing that organization

### Example 3: Search and Explore
1. Go to `/users`
2. Search for "admin"
3. Click "View Details" on Admin User
4. See all organizations they belong to
5. Explore each organization

---

## 🎨 UI Features

### User Cards
- **Avatar**: Profile image or gradient with initials
- **Verification Badge**: Green checkmark or gray X
- **Organizations**: List up to 3, show "+X more" if more than 3
- **Role Badges**: 
  - Purple for Owner
  - Blue for Admin
  - Gray for User

### Loading States
- Spinning loader with "Loading..." message
- Shows while data is being fetched

### Error States
- Red error icon with error message
- "Try again" button to refetch data

### Empty States
- Icon with "No users found" message
- Shows when search returns no results

---

## 🔍 Search Functionality

### How it works:
1. Type in the search bar
2. Wait 300ms (debounce)
3. Query automatically executes
4. Results update in real-time
5. Page resets to 1

### What you can search:
- User names (case-insensitive)
- Email addresses (partial match)

---

## 📄 Pagination

### Current Implementation:
- **Page Size**: 20 users per page
- **Navigation**: Previous/Next buttons
- **Display**: "Page X of Y" counter
- **Disabled States**: 
  - Previous disabled on page 1
  - Next disabled on last page

### How it works:
- Click "Next" to go to next page
- Click "Previous" to go back
- Search resets to page 1
- Page number displays in stats card

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Users page loads successfully
- [ ] Users display in grid layout
- [ ] Search filters users correctly
- [ ] Pagination works (Previous/Next)
- [ ] "View Details" navigates to user detail
- [ ] "View Org" navigates to organization detail

### User Detail Page
- [ ] User information displays correctly
- [ ] Organizations list shows all memberships
- [ ] Role badges display correct colors
- [ ] "View Details" navigates to org detail
- [ ] Back button returns to users list

### Organization Detail Page
- [ ] Organization info displays correctly
- [ ] Stats cards show accurate counts
- [ ] Members list displays all members
- [ ] "View User" navigates to user detail
- [ ] Back button returns to organizations list

### Edge Cases
- [ ] Search with no results shows empty state
- [ ] User with no organizations shows message
- [ ] Organization with no members shows message
- [ ] Loading states appear during queries
- [ ] Error states handle failed queries

### Navigation Flow
- [ ] Users → Org → User cycle works
- [ ] Org → User → Org cycle works
- [ ] Back buttons maintain context
- [ ] URLs update correctly
- [ ] Browser back/forward works

---

## 🐛 Troubleshooting

### Users page shows "Authentication required"
**Solution**: Make sure you're logged in as admin or superAdmin

### Search returns no results
**Solution**: Check if users exist in database, try broader search terms

### "View Details" button does nothing
**Solution**: Check browser console for errors, verify routing is configured

### Organizations not showing in user detail
**Solution**: Verify user has organization memberships in database

### Stats show 0 for forms/responses
**Solution**: This is correct if organization has no forms or responses

---

## 📊 Database Schema Reference

### User Model
```typescript
{
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  createdAt: Date
  updatedAt: Date
}
```

### Member Model (Organization Membership)
```typescript
{
  userId: string
  organizationId: string
  role: string // "user" | "owner" | "admin"
  createdAt: Date
}
```

### Organization Model
```typescript
{
  id: string
  name: string
  slug: string | null
  logo: string | null
  createdAt: Date
}
```

---

## 🎯 Quick Tips

1. **Fast Navigation**: Use browser back/forward buttons
2. **Search Performance**: Search is debounced, wait 300ms after typing
3. **Page Context**: Back buttons always return to list views
4. **Visual Feedback**: Watch for loading spinners during queries
5. **Error Handling**: Click retry button if query fails

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify backend is running on port 4000
3. Verify admin app is running on port 3002
4. Check GraphQL Playground: `http://localhost:4000/graphql`
5. Review implementation docs: `USERS_MANAGEMENT_IMPLEMENTATION.md`

---

**Happy Testing!** 🎉
