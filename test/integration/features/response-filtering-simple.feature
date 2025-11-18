@response-filtering-simple
Feature: Simple Response Filtering Test
  Test basic filtering functionality

  Scenario: Filter text responses
    Given I am logged in as "filtertest@example.com" with password "testpass123"
    And I create an organization with name "Filter Org" and slug "filter-org-test"
    And I create a comprehensive test form with all field types
    And I submit a response with text field "Full Name" value "Alice Johnson"
    And I submit a response with text field "Full Name" value "Bob Smith"
    When I filter responses by text field "Full Name" equals "Alice Johnson"
    Then I should see 1 response
    And the response should have text field "Full Name" value "Alice Johnson"

