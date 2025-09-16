@TemplateAuthorization
Feature: Template Authorization and Authentication
  As a system user
  I want to access templates with proper authorization
  So that queries are public and mutations require appropriate permissions

  Background:
    Given the backend server is running

  Scenario: Template queries - require authentication - authenticated user success
    Given I create and authenticate a test user
    When I send an authenticated GraphQL query to get all templates
    Then I should receive templates data successfully
    And the response should contain a list of templates

  Scenario: Template by ID query - require authentication - authenticated user success
    Given I create and authenticate a test user
    And there is at least one template in the system
    When I send an authenticated GraphQL query to get a template by ID
    Then I should receive template data successfully
    And the response should contain template details

  Scenario: Templates by category query - require authentication - authenticated user success
    Given I create and authenticate a test user
    When I send an authenticated GraphQL query to get templates by category
    Then I should receive templates by category data successfully
    And the response should contain categorized templates

  Scenario: Template categories query - require authentication - authenticated user success
    Given I create and authenticate a test user
    When I send an authenticated GraphQL query to get template categories
    Then I should receive template categories successfully
    And the response should contain a list of categories

  Scenario: Template queries - unauthenticated user should be denied
    When I send a GraphQL query to get all templates without authentication
    Then I should receive an authentication error
    And the error message should indicate authentication is required

  Scenario: Template by ID query - unauthenticated user should be denied
    Given there is at least one template in the system
    When I send a GraphQL query to get a template by ID without authentication
    Then I should receive an authentication error
    And the error message should indicate authentication is required

  Scenario: Templates by category query - unauthenticated user should be denied
    When I send a GraphQL query to get templates by category without authentication
    Then I should receive an authentication error
    And the error message should indicate authentication is required

  Scenario: Template categories query - unauthenticated user should be denied
    When I send a GraphQL query to get template categories without authentication
    Then I should receive an authentication error
    And the error message should indicate authentication is required

  Scenario: Create template - requires system-level role (admin)
    Given I create and authenticate a test admin user
    When I send an authenticated GraphQL mutation to create a template
    Then the template should be created successfully
    And the response should contain the created template data

  Scenario: Create template - requires system-level role (superAdmin)
    Given I create and authenticate a test super admin user
    When I send an authenticated GraphQL mutation to create a template
    Then the template should be created successfully
    And the response should contain the created template data

  Scenario: Create template - regular user should be denied
    Given I create and authenticate a test user
    When I send an authenticated GraphQL mutation to create a template
    Then I should receive an authorization error
    And the error message should indicate admin privileges are required

  Scenario: Create template - unauthenticated user should be denied
    When I send a GraphQL mutation to create a template without authentication
    Then I should receive an authentication error
    And the error message should indicate authentication is required

  Scenario: Update template - requires system-level role (admin)
    Given I create and authenticate a test admin user
    And there is at least one template in the system
    When I send an authenticated GraphQL mutation to update a template
    Then the template should be updated successfully
    And the response should contain the updated template data

  Scenario: Update template - regular user should be denied
    Given I create and authenticate a test user
    And there is at least one template in the system
    When I send an authenticated GraphQL mutation to update a template
    Then I should receive an authorization error
    And the error message should indicate admin privileges are required

  Scenario: Update template - unauthenticated user should be denied
    Given there is at least one template in the system
    When I send a GraphQL mutation to update a template without authentication
    Then I should receive an authentication error
    And the error message should indicate authentication is required

  Scenario: Delete template - requires system-level role (admin)
    Given I create and authenticate a test admin user
    And there is at least one template in the system
    When I send an authenticated GraphQL mutation to delete a template
    Then the template should be deleted successfully
    And the response should confirm deletion

  Scenario: Delete template - regular user should be denied
    Given I create and authenticate a test user
    And there is at least one template in the system
    When I send an authenticated GraphQL mutation to delete a template
    Then I should receive an authorization error
    And the error message should indicate admin privileges are required

  Scenario: Delete template - unauthenticated user should be denied
    Given there is at least one template in the system
    When I send a GraphQL mutation to delete a template without authentication
    Then I should receive an authentication error
    And the error message should indicate authentication is required

  Scenario: Create form from template - authenticated user
    Given I create and authenticate a test user
    And there is at least one template in the system
    When I send an authenticated GraphQL mutation to create a form from template
    Then the form should be created successfully from template
    And the response should contain the created form data

  Scenario: Create form from template - unauthenticated user should be denied
    Given there is at least one template in the system
    When I send a GraphQL mutation to create a form from template without authentication
    Then I should receive an authentication error
    And the error message should indicate authentication is required