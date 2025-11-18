@response-filtering
Feature: Checkbox Field CONTAINS_ALL Operator
  As a form owner
  I want to filter responses where checkboxes contain ALL specified values
  So that I can find responses with complete selections

  Background:
    Given I am logged in as "formowner@example.com" with password "password123"
    And I create an organization with name "Filter Test Org" and slug "filter-test-org"
    And I create a comprehensive test form with all field types

  Scenario: Filter responses that have all specified values
    Given I submit a response with checkbox field "Interests" values "Sports,Music,Reading"
    And I submit a response with checkbox field "Interests" values "Sports,Music"
    And I submit a response with checkbox field "Interests" values "Music,Reading,Gaming"
    And I submit a response with checkbox field "Interests" values "Sports,Music,Reading,Gaming"
    When I filter responses by checkbox field "Interests" operator "CONTAINS_ALL" with values "Sports,Music"
    Then I should see 3 responses
    And all responses should have checkbox field "Interests" containing all values "Sports,Music"

  Scenario: Filter with CONTAINS_ALL returns only exact matches
    Given I submit a response with checkbox field "Interests" values "Sports,Music,Reading"
    And I submit a response with checkbox field "Interests" values "Sports,Gaming"
    And I submit a response with checkbox field "Interests" values "Music,Reading"
    When I filter responses by checkbox field "Interests" operator "CONTAINS_ALL" with values "Sports,Music,Reading"
    Then I should see 1 response
    And the response should have checkbox field "Interests" with values "Sports,Music,Reading"

  Scenario: CONTAINS_ALL with single value
    Given I submit a response with checkbox field "Interests" values "Sports"
    And I submit a response with checkbox field "Interests" values "Sports,Music"
    And I submit a response with checkbox field "Interests" values "Music"
    When I filter responses by checkbox field "Interests" operator "CONTAINS_ALL" with values "Sports"
    Then I should see 2 responses
    And all responses should have checkbox field "Interests" containing all values "Sports"

  Scenario: CONTAINS_ALL returns no results when value not present
    Given I submit a response with checkbox field "Interests" values "Sports,Music"
    And I submit a response with checkbox field "Interests" values "Reading,Gaming"
    When I filter responses by checkbox field "Interests" operator "CONTAINS_ALL" with values "Sports,Gaming,Reading"
    Then I should see 0 responses
