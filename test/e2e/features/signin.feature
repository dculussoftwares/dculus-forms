Feature: User Sign In
  As an existing user
  I want to sign in to my account
  So that I can access the form builder application

  Background:
    Given I have test credentials ready

  Scenario: Complete sign up then sign in flow
    Given I am signed in as a new user
    Then I should be successfully signed in

  Scenario: Sign in with missing required fields
    Given I am on the sign in page
    When I click the "Sign in" button without filling any fields
    Then I should see validation errors for required fields:
      | Field Name | Error Message        |
      | Email      | Email is required    |
      | Password   | Password is required |

  Scenario: Sign in with invalid email format
    Given I am on the sign in page
    When I fill in the sign in form with:
      | Field Name | Value           |
      | Email      | invalid-email   |
      | Password   | TestPassword123! |
    And I click the "Sign in" button
    Then I should see an error message "Please include an '@' in the email address"

  Scenario: Sign in with invalid credentials
    Given I am on the sign in page
    When I fill in the sign in form with:
      | Field Name | Value                    |
      | Email      | nonexistent@example.com  |
      | Password   | WrongPassword123!        |
    And I click the "Sign in" button
    Then I should see an error message "Invalid email or password"

  Scenario: Navigate to sign up page from sign in
    Given I am on the sign in page
    When I click the "Sign up" link
    Then I should be redirected to the sign up page