Feature: Form Creation
  As a user
  I want to create a form after signing up and signing in
  So that I can build and manage my forms

  Background:
    Given I have test credentials ready

  Scenario: Complete form creation flow with new user
    Given I am on the sign up page
    When I fill in the sign up form with valid data:
      | Field Name          | Value                    |
      | Full Name           | Form Creator             |
      | Email               | {generated_email}        |
      | Organization Name   | {generated_organization} |
      | Password            | TestPassword123!         |
      | Confirm Password    | TestPassword123!         |
    And I click the "Create account" button
    Then I should be redirected to the home page
    When I navigate to the sign in page
    And I fill in the sign in form with the stored credentials
    And I click the "Sign in" button
    Then I should be redirected to the home page
    And I should be successfully signed in
    And I should see the dashboard with forms content
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    And I should see available templates
    When I select the first available template
    And I fill in the form creation details:
      | Field Name    | Value                          |
      | Form Title    | My New Test Form               |
      | Description   | This is a test form created    |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    And I should see the form builder interface