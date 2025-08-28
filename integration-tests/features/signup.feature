Feature: User Signup API
  As a new user
  I want to create an account and organization
  So that I can start using the forms application

  Background:
    Given the backend server is running
    And the database is clean for signup tests

  Scenario: Successful user signup with organization
    When I send a POST request to "/api/sign-up" with:
      | name             | email                    | password       | organizationName |
      | John Doe         | john.doe@example.com     | password123    | Acme Corp        |
    Then the response status code should be 201
    And the response should contain "user" field
    And the response should contain "token" field
    And the user should have email "john.doe@example.com"
    And the user should have name "John Doe"

  Scenario: Signup with invalid email format
    When I send a POST request to "/api/sign-up" with:
      | name     | email           | password       | organizationName |
      | John Doe | invalid-email   | password123    | Acme Corp        |
    Then the response status code should be 400
    And the response should contain "error" field
    And the error message should contain "email"

  Scenario: Signup with short password
    When I send a POST request to "/api/sign-up" with:
      | name     | email                | password | organizationName |
      | John Doe | john@example.com     | 123      | Acme Corp        |
    Then the response status code should be 400
    And the response should contain "error" field
    And the error message should contain "password"

  Scenario: Signup with missing organization name
    When I send a POST request to "/api/sign-up" with:
      | name     | email                | password    | organizationName |
      | John Doe | john@example.com     | password123 |                  |
    Then the response status code should be 400
    And the response should contain "error" field
    And the error message should contain "organization"

  Scenario: Signup with duplicate email
    Given a user already exists with email "existing@example.com"
    When I send a POST request to "/api/sign-up" with:
      | name     | email                   | password    | organizationName |
      | Jane Doe | existing@example.com    | password123 | Another Corp     |
    Then the response status code should be 409
    And the response should contain "error" field
    And the error message should contain "already exists"

  Scenario: Successful signin after signup
    Given I have successfully signed up with:
      | name     | email                | password    | organizationName |
      | Jane Doe | jane@example.com     | password123 | Jane Corp        |
    When I send a POST request to "/api/sign-in" with:
      | email               | password    |
      | jane@example.com    | password123 |
    Then the response status code should be 200
    And the response should contain "user" field
    And the response should contain "token" field
    And the user should have email "jane@example.com"
