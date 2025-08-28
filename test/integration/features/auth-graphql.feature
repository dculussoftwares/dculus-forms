Feature: GraphQL Authentication Test
  As an integration test
  I want to test GraphQL queries with authentication
  So that I can verify authenticated endpoints work correctly

  Background:
    Given the backend server is running

  Scenario: Authenticated GraphQL request
    Given I create and authenticate a test user
    When I send an authenticated GraphQL query to get my user information
    Then I should receive my user data successfully
    And the user data should match my authenticated user

  Scenario: Unauthenticated GraphQL request
    When I send a GraphQL query without authentication token
    Then I should receive an authentication error