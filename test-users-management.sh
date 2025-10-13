#!/bin/bash
# Test Users Management Feature

echo "🧪 Testing Users Management Feature"
echo "===================================="
echo ""

# Test 1: Test adminUsers query
echo "Test 1: Fetching all users (paginated)"
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "query": "query AdminUsers($page: Int, $limit: Int, $search: String) { adminUsers(page: $page, limit: $limit, search: $search) { users { id name email emailVerified organizations { organizationId organizationName role } } totalCount currentPage totalPages } }",
    "variables": {
      "page": 1,
      "limit": 10
    }
  }'

echo ""
echo ""

# Test 2: Test adminUsers query with search
echo "Test 2: Searching users by email"
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "query": "query AdminUsers($page: Int, $limit: Int, $search: String) { adminUsers(page: $page, limit: $limit, search: $search) { users { id name email } totalCount } }",
    "variables": {
      "search": "admin"
    }
  }'

echo ""
echo ""

# Test 3: Test adminUserById query
echo "Test 3: Fetching single user by ID"
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "query": "query AdminUserById($id: String!) { adminUserById(id: $id) { id name email emailVerified image createdAt updatedAt organizations { organizationId organizationName organizationSlug role createdAt } } }",
    "variables": {
      "id": "USER_ID_HERE"
    }
  }'

echo ""
echo ""

# Test 4: Test adminOrganizationById query
echo "Test 4: Fetching organization details with members"
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "query": "query AdminOrganizationById($id: String!) { adminOrganizationById(id: $id) { id name slug logo createdAt members { userId userName userEmail role createdAt } stats { totalForms totalResponses } } }",
    "variables": {
      "id": "ORG_ID_HERE"
    }
  }'

echo ""
echo ""
echo "✅ Tests complete!"
echo ""
echo "📝 Manual Testing Steps:"
echo "1. Start the backend: cd apps/backend && pnpm dev"
echo "2. Start the admin app: cd apps/admin-app && pnpm dev"
echo "3. Login as admin (admin@dculus.com / admin123!@#)"
echo "4. Navigate to /users"
echo "5. Test search functionality"
echo "6. Test pagination"
echo "7. Click 'View Details' on a user"
echo "8. Click 'View Details' on an organization in user detail"
echo "9. Click 'View User' on a member in organization detail"
echo "10. Test back navigation"
