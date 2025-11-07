Feature: Account Creation
  As a new user
  I want to create an account
  So that I can use the dculus-forms platform

  Background:
    Given the database is clean

  Scenario: Successful account creation with valid credentials
    Given I want to sign up with email "newuser@example.com" and password "SecurePass123!"
    When I submit the signup request
    Then the signup should be successful
    And the user should exist in the database with email "newuser@example.com"
    And the user should have role "user"
    And a session token should be returned

  Scenario: Account creation with invalid email format
    Given I want to sign up with email "invalid-email" and password "SecurePass123!"
    When I submit the signup request
    Then the signup should fail with error code 400
    And the error message should mention "email"

  Scenario: Account creation with weak password
    Given I want to sign up with email "weakpass@example.com" and password "123"
    When I submit the signup request
    Then the signup should fail with error code 400
    And the error message should mention "password"

  Scenario: Account creation with duplicate email
    Given a user already exists with email "existing@example.com"
    When I try to sign up with email "existing@example.com" and password "NewPass123!"
    Then the signup should fail with error code 422
    And the error should indicate duplicate email

  Scenario: Account creation with missing required fields
    Given I prepare a signup request without email
    When I submit the incomplete signup request
    Then the signup should fail with error code 400
    And the error should indicate missing required field

  Scenario: Account creation with special characters in name
    Given I want to sign up with email "special@example.com", password "SecurePass123!", and name "John O'Brien-Smith"
    When I submit the signup request with name
    Then the signup should be successful
    And the user name should be "John O'Brien-Smith"
