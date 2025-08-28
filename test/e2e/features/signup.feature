Feature: User Sign Up
  As a new user
  I want to create an account
  So that I can use the form builder application

  Background:
    Given I am on the sign up page

  Scenario: Successful user registration
    When I fill in the sign up form with valid data:
      | Field Name          | Value                    |
      | Full Name           | John Doe                 |
      | Email               | {generated_email}        |
      | Organization Name   | {generated_organization} |
      | Password            | TestPassword123!         |
      | Confirm Password    | TestPassword123!         |
    And I click the "Create account" button
    Then I should be redirected to the home page
    And I should see a success message or be signed out

  Scenario: Sign up with missing required fields
    When I click the "Create account" button without filling any fields
    Then I should see validation errors for all required fields:
      | Field Name        | Error Message                |
      | Full Name         | Full name is required        |
      | Email             | Email is required            |
      | Organization Name | Organization name is required |
      | Password          | Password is required         |

  Scenario: Sign up with invalid email format
    When I fill in the sign up form with:
      | Field Name          | Value              |
      | Full Name           | John Doe           |
      | Email               | invalid-email      |
      | Organization Name   | Test Organization  |
      | Password            | TestPassword123!   |
      | Confirm Password    | TestPassword123!   |
    And I click the "Create account" button
    Then I should see an error message "email address"

  Scenario: Sign up with password too short
    When I fill in the sign up form with:
      | Field Name          | Value              |
      | Full Name           | John Doe           |
      | Email               | john@example.com   |
      | Organization Name   | Test Organization  |
      | Password            | short              |
      | Confirm Password    | short              |
    And I click the "Create account" button
    Then I should see an error message "Password must be at least 8 characters"

  Scenario: Sign up with mismatched passwords
    When I fill in the sign up form with:
      | Field Name          | Value              |
      | Full Name           | John Doe           |
      | Email               | john@example.com   |
      | Organization Name   | Test Organization  |
      | Password            | TestPassword123!   |
      | Confirm Password    | DifferentPassword  |
    And I click the "Create account" button
    Then I should see an error message "Passwords don't match"

  Scenario: Navigate to sign in page
    When I click the "Sign in" link
    Then I should be redirected to the sign in page