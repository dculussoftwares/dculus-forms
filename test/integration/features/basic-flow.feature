Feature: Basic User Flow
  As a new user
  I want to sign up, create an organization, and create a form
  So that I can start using the dculus-forms platform

  Scenario: Complete basic user journey
    Given I am a new user with email "testuser@example.com" and password "SecurePass123!"
    When I sign up with my credentials
    Then I should be successfully signed up
    And I should have an authentication token
    When I create an organization named "My Test Organization"
    Then the organization should be created successfully
    And I should be set as the organization owner
    When I create a form with title "My First Form"
    Then the form should be created successfully
    And the form should belong to my organization
