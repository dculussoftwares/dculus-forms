Feature: Super Admin Sign Up and Authentication
  As a system administrator
  I want to create and authenticate super admin accounts
  So that I can manage the system via admin APIs

  Background:
    Given the backend server is running

  Scenario: Test admin setup script execution
    Given I have super admin test credentials  
    When I run the admin setup script
    Then the setup script should complete successfully
    And I should be able to sign in with the admin credentials

  Scenario: Super admin authentication and GraphQL access
    Given I have created a super admin user
    When I sign in with the super admin credentials
    Then I should be authenticated successfully
    And I should have an admin auth token
    When I send an admin GraphQL query to get system stats
    Then I should receive admin data successfully
    And the stats should include system metrics

  Scenario: Admin GraphQL queries - Organizations
    Given I have created and authenticated a super admin user
    When I send an admin GraphQL query to get all organizations
    Then I should receive organizations data successfully
    And the organizations list should be properly formatted

  Scenario: Admin GraphQL queries - Organization by ID
    Given I have created and authenticated a super admin user
    And I have a test organization in the system
    When I send an admin GraphQL query to get organization details by ID
    Then I should receive organization details successfully
    And the organization details should include members and forms

  Scenario: Non-admin user cannot access admin GraphQL queries
    Given I create and authenticate a regular test user
    When I send an admin GraphQL query with regular user token
    Then I should receive an admin privileges required error

  Scenario: Unauthenticated admin GraphQL request
    When I send an admin GraphQL query without authentication token
    Then I should receive an authentication error

  Scenario: Super admin role verification
    Given I have created a super admin user
    When I sign in with the super admin credentials
    Then the authenticated user should have superAdmin role
    And the user should pass admin role validation

  Scenario: Update existing user to super admin role
    Given I have a regular user in the system
    When I update the user role to superAdmin using the setup process
    Then the user should have superAdmin role
    And the user should be able to access admin GraphQL queries