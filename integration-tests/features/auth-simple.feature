Feature: Simple Authentication Test
  As an integration test
  I want to test basic authentication functionality
  So that I can verify the auth utils work correctly

  Background:
    Given the backend server is running

  Scenario: Basic auth utilities test
    When I test the auth utilities directly
    Then I should be able to create and authenticate a user