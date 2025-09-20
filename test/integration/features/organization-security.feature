@OrganizationSecurity @Integration @Security
Feature: Organization Security Tests
  As a security-focused test suite
  I want to test organization membership verification and authorization
  So that I can ensure users can only access organizations they belong to

  Background:
    Given the backend server is running

  @setActiveOrganization @Security @MembershipVerification
  Scenario: User can set active organization they belong to
    Given I am authenticated as a test user with an organization
    When I send a setActiveOrganization mutation with my organization ID
    Then the mutation should succeed
    And I should receive the organization details
    And the organization should contain my user as a member

  @setActiveOrganization @Security @UnauthorizedAccess
  Scenario: User cannot set active organization they don't belong to
    Given I am authenticated as a test user with an organization
    And there exists another organization I am not a member of
    When I send a setActiveOrganization mutation with the other organization ID
    Then the mutation should fail with an access denied error
    And the error message should indicate "You are not a member of this organization"

  @setActiveOrganization @Security @Unauthenticated
  Scenario: Unauthenticated user cannot set active organization
    Given I am not authenticated for organization security tests
    When I send a setActiveOrganization mutation with any organization ID
    Then the mutation should fail with an authentication error
    And the organization security error message should indicate authentication is required

  @setActiveOrganization @Security @NonexistentOrganization
  Scenario: User cannot set active organization that doesn't exist
    Given I am authenticated as a test user with an organization
    When I send a setActiveOrganization mutation with a nonexistent organization ID
    Then the mutation should fail with an access denied error
    And the error message should indicate "You are not a member of this organization"

  @setActiveOrganization @Security @InvalidToken
  Scenario: Invalid token prevents setting active organization
    Given I have an invalid authentication token
    When I send a setActiveOrganization mutation with any organization ID
    Then the mutation should fail with an authentication error
    And the error message should indicate the token is invalid

  @setActiveOrganization @Security @OrganizationLimit
  Scenario: User cannot create multiple organizations due to organization limit
    Given I am authenticated as a test user with an organization
    When I attempt to create a second organization
    Then the operation should fail with an organization limit error
    And the error message should indicate "User can only belong to one organization"

  @setActiveOrganization @Security @RoleBasedAccess
  Scenario: Users with different roles can set active organization
    Given I am authenticated as a test user with "member" role in an organization
    When I send a setActiveOrganization mutation with my organization ID
    Then the mutation should succeed
    And I should receive the organization details
    Given I am authenticated as a test user with "owner" role in an organization
    When I send a setActiveOrganization mutation with my organization ID
    Then the mutation should succeed
    And I should receive the organization details

  @setActiveOrganization @Security @GraphQLInjection
  Scenario: GraphQL injection attempts are handled safely
    Given I am authenticated as a test user with an organization
    When I send a setActiveOrganization mutation with malicious GraphQL injection in organization ID
    Then the mutation should fail safely
    And no sensitive data should be exposed

  @setActiveOrganization @Security @SQLInjection
  Scenario: SQL injection attempts are handled safely
    Given I am authenticated as a test user with an organization
    When I send a setActiveOrganization mutation with SQL injection patterns in organization ID
    Then the mutation should fail safely
    And no database errors should be exposed

  @setActiveOrganization @Security @RateLimiting
  Scenario: Rate limiting prevents organization enumeration attacks
    Given I am authenticated as a test user with an organization
    When I send multiple rapid setActiveOrganization mutations with random organization IDs
    Then the system should handle the requests appropriately
    And not expose information about organization existence through timing differences