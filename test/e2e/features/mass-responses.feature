@mass-responses
Feature: Mass Response Generation
  Test form submission with 120+ varied responses to enable comprehensive testing
  of data storage, analytics, and form handling capabilities.

  Scenario: Create multi-page form and submit 120+ varied responses
    Given I sign in with valid credentials
    When I create a mass response test form via GraphQL
    Then I should be on the new form dashboard
    # Publish the form
    When I publish the form
    Then the form should be published
    When I get the form short URL
    # Submit 120+ responses with varied data
    When I submit 120 responses with varied data
    Then all 120 responses should be submitted successfully
