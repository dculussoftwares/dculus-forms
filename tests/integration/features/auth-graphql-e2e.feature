Feature: End-to-End Authentication with GraphQL Operations
  As a user of the Dculus Forms system
  I want to complete the full authentication and form management workflow
  So that I can create, manage, and submit forms within my organization

  Background:
    Given the backend service is running
    And the authentication system is ready

  @e2e @auth @forms @critical
  Scenario: Complete user journey - Signup to Form Creation
    # Step 1: User Registration
    When I sign up with the following details:
      | field            | value                    |
      | email            | e2e-user@example.com    |
      | password         | securepass123           |
      | name             | E2E Test User           |
      | organizationName | E2E Test Organization   |
    Then the signup should be successful
    And I should receive an authentication token

    # Step 2: Profile Verification
    When I make an authenticated GraphQL query to get my profile:
      """
      query {
        me {
          id
          email
          name
          createdAt
        }
      }
      """
    Then the GraphQL response should be successful
    And the profile should contain:
      | field | value                |
      | email | e2e-user@example.com |
      | name  | E2E Test User        |

    # Step 3: Organization Access
    When I query my organizations via GraphQL:
      """
      query {
        myOrganizations {
          id
          name
          slug
          members {
            id
            role
            user {
              email
              name
            }
          }
        }
      }
      """
    Then the GraphQL response should be successful
    And I should have 1 organization
    And the organization should have name "E2E Test Organization"
    And I should be the owner of the organization

    # Step 4: Active Organization Check
    When I query my active organization via GraphQL:
      """
      query {
        activeOrganization {
          id
          name
          members {
            role
            user {
              email
            }
          }
        }
      }
      """
    Then the GraphQL response should be successful
    And the active organization should be "E2E Test Organization"
    And I should be listed as a member


  @e2e @auth @multi-user @organization
  Scenario: Multi-user Organization Workflow
    # First user creates organization
    Given I sign up with email "org-owner@example.com" and organization "Multi User Org"
    When I query my organizations via GraphQL:
      """
      query {
        myOrganizations {
          id
          name
          members {
            role
            user {
              email
            }
          }
        }
      }
      """
    Then the GraphQL response should be successful
    And I should be the owner of the organization
    
    # Store organization info for second user
    And I store the organization ID as "multiUserOrgId"
    
    # Second user joins (simulated - in real scenario would be invited)
    When I sign out
    And I sign up with email "org-member@example.com" and organization "Member Temp Org"
    Then I should receive an authentication token
    
    # Verify second user can authenticate
    When I make an authenticated GraphQL query to get my profile:
      """
      query {
        me {
          id
          email
        }
      }
      """
    Then the GraphQL response should be successful
    And the profile email should be "org-member@example.com"

  @e2e @auth @session @persistence
  Scenario: Session Persistence and Token Validation
    Given I sign up with email "session-user@example.com" and organization "Session Org"
    
    # Make initial authenticated request
    When I make an authenticated GraphQL query to get my profile:
      """
      query {
        me {
          id
          email
          name
        }
      }
      """
    Then the GraphQL response should be successful
    
    # Make multiple requests to ensure token persists
    When I make 5 consecutive authenticated GraphQL requests:
      """
      query {
        me {
          id
          email
        }
        activeOrganization {
          id
          name
        }
      }
      """
    Then all GraphQL responses should be successful
    And each response should contain the same user information
    
    # Verify token still works after some time (simulate session persistence)
    When I wait 2 seconds
    And I make an authenticated GraphQL query to get my profile:
      """
      query {
        me {
          id
          email
        }
      }
      """
    Then the GraphQL response should be successful
    And the profile email should be "session-user@example.com"

  @e2e @auth @error-handling @resilience
  Scenario: Error Handling and Recovery
    Given I sign up with email "error-user@example.com" and organization "Error Test Org"
    
    # Test malformed GraphQL query
    When I make an authenticated GraphQL query with invalid syntax:
      """
      query {
        me {
          id
          email
          invalidField
        }
      """
    Then the GraphQL response should contain errors
    But the authentication should still be valid
    
    # Test valid query after error to ensure connection is still good
    When I make an authenticated GraphQL query to get my profile:
      """
      query {
        me {
          id
          email
        }
      }
      """
    Then the GraphQL response should be successful
    And the profile email should be "error-user@example.com"
    
    # Test unauthorized query after signout
    When I sign out
    And I make a GraphQL query without authentication:
      """
      query {
        me {
          id
          email
        }
      }
      """
    Then the GraphQL response should fail with authentication error