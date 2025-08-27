Feature: User Authentication and Signup Integration
  As a new user
  I want to sign up for an account and create an organization
  So that I can access authenticated GraphQL operations

  Background:
    Given the backend service is running
    And the authentication system is ready

  @auth @signup @smoke
  Scenario: Successful user signup with organization creation
    When I sign up with the following details:
      | field            | value                    |
      | email            | test@example.com         |
      | password         | securepass123           |
      | name             | John Doe                |
      | organizationName | Test Organization       |
    Then the signup should be successful
    And I should receive an authentication token
    And the response should contain user information

  @auth @signup @graphql
  Scenario: Signup followed by authenticated GraphQL query
    Given I sign up with email "testuser@example.com" and organization "My Test Org"
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
    And the profile should contain:
      | field | value                |
      | email | testuser@example.com |
      | name  | Test User           |

  @auth @signup @organization
  Scenario: Signup and create organization via GraphQL
    Given I sign up with email "orgowner@example.com" and organization "GraphQL Org"
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
              id
              email
            }
          }
        }
      }
      """
    Then the GraphQL response should be successful
    And I should have 1 organization
    And the organization should have name "GraphQL Org"
    And I should be the owner of the organization

  @auth @signup @active-organization
  Scenario: Access active organization after signup
    Given I sign up with email "activeuser@example.com" and organization "Active Org"
    When I query my active organization via GraphQL:
      """
      query {
        activeOrganization {
          id
          name
          members {
            id
            role
            user {
              email
            }
          }
        }
      }
      """
    Then the GraphQL response should be successful
    And the active organization should be "Active Org"
    And I should be listed as a member

  @auth @signin @existing-user
  Scenario: Sign in with existing user credentials
    Given I have signed up with email "existinguser@example.com"
    When I sign out
    And I sign in with email "existinguser@example.com" and password "testpass123"
    Then the signin should be successful
    And I should receive an authentication token
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
    And the profile email should be "existinguser@example.com"

  @auth @unauthorized @graphql
  Scenario: GraphQL queries fail without authentication
    Given I am not authenticated
    When I make a GraphQL query without authentication:
      """
      query {
        me {
          id
          email
        }
      }
      """
    Then the GraphQL response should fail with authentication error
    And the error message should mention "Authentication required"

  @auth @invalid-token @graphql
  Scenario: GraphQL queries fail with invalid token
    Given I have an invalid authentication token "invalid-token-12345"
    When I make a GraphQL query with the invalid token:
      """
      query {
        me {
          id
          email
        }
      }
      """
    Then the GraphQL response should fail with authentication error
    And the error message should mention "Authentication required"

  @auth @signup @duplicate-email
  Scenario: Signup fails with duplicate email
    Given I have signed up with email "duplicate@example.com"
    When I attempt to sign up again with email "duplicate@example.com"
    Then the signup should fail
    And the error should indicate the email is already taken

  @auth @signup @validation
  Scenario Outline: Signup validation errors
    When I sign up with invalid details:
      | field            | value           |
      | email            | <email>         |
      | password         | <password>      |
      | name             | <name>          |
      | organizationName | <organization>  |
    Then the signup should fail
    And the error should mention "<error_message>"

    Examples:
      | email           | password | name      | organization | error_message |
      | invalid-email   | pass123  | John Doe  | Test Org     | email         |
      | test@example.com| 123      | John Doe  | Test Org     | password      |
      | test@example.com| pass123  |           | Test Org     | name          |
      | test@example.com| pass123  | John Doe  |              | organization  |

  @auth @performance @signup
  Scenario: Signup performance is acceptable
    When I sign up with email "perf@example.com"
    Then the signup should complete within 3 seconds
    And I should receive an authentication token

  @auth @session @multiple-requests
  Scenario: Authentication token works for multiple GraphQL requests
    Given I sign up with email "multiuser@example.com" and organization "Multi Org"
    When I make 3 consecutive authenticated GraphQL requests:
      """
      query {
        me {
          id
          email
        }
      }
      """
    Then all GraphQL responses should be successful
    And each response should contain the same user information