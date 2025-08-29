@FormCreation
Feature: Form Creation
  As a user
  I want to create a form after signing up and signing in
  So that I can build and manage my forms

  Background:
    Given I have test credentials ready
    And I am signed in as a new user

  @Auth
  Scenario: New user signup and signin for form creation
    Then I should see the dashboard with forms content

  @Navigation
  Scenario: Navigate to templates page from dashboard
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    And I should see available templates

  @Creation
  Scenario: Create form from template
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the first available template
    And I fill in the form creation details:
      | Field Name    | Value                          |
      | Form Title    | My New Test Form               |
      | Description   | This is a test form created    |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    And I should see the form builder interface

  @Creation @EventRegistration
  Scenario: Create form from Event Registration template
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Summer Conference 2025                   |
      | Description   | Registration for our annual conference   |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    And I should see the form builder interface

  @Validation
  Scenario: Form creation validation - missing title
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the first available template
    And I fill in the form creation details:
      | Field Name    | Value                          |
      | Form Title    |                                |
      | Description   | Form without title             |
    And I click the "Create Form" button in the template popover
    Then I should see an error message "Form title is required"