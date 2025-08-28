Feature: Authentication Integration Tests
  As an integration test suite
  I want to test user authentication and authorization
  So that I can verify the GraphQL endpoints work with proper authentication

  Background:
    Given the backend server is running

  Scenario: User sign up with organization creation
    When I sign up a new test user with organization
    Then the user should be successfully created
    And the organization should be created
    And I should receive an authentication token

  Scenario: User sign in with valid credentials
    Given I have created a test user for sign in
    When I sign in with the test user credentials
    Then I should be successfully authenticated
    And I should receive an authentication token
    And I should have access to my user information

  Scenario: GraphQL query with authentication
    Given I am authenticated as a test user
    When I send a GraphQL query to get my user information
    Then I should receive my user data
    And the response should contain my email and name

  Scenario: GraphQL query for user organizations
    Given I am authenticated as a test user with an organization
    When I send a GraphQL query to get my organizations
    Then I should receive a list containing my organization
    And the organization should have the correct name and members

  Scenario: Unauthorized GraphQL request
    When I send a GraphQL query without authentication
    Then I should receive an authentication error
    And the response should indicate authentication is required

  Scenario: Invalid authentication token
    When I send a GraphQL query with an invalid token
    Then I should receive an authentication error
    And the response should indicate the token is invalid