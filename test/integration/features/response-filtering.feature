@response-filtering
Feature: Form Response Filtering
  As a form owner
  I want to filter and search through form responses
  So that I can analyze submissions efficiently

  Background:
    Given I am logged in as "formowner@example.com" with password "password123"
    And I create an organization with name "Filter Test Org" and slug "filter-test-org"
    And I create a comprehensive test form with all field types

  Scenario: Filter text input responses by exact match
    Given I submit a response with text field "Full Name" value "John Doe"
    And I submit a response with text field "Full Name" value "Jane Smith"
    And I submit a response with text field "Full Name" value "John Smith"
    When I filter responses by text field "Full Name" equals "John Doe"
    Then I should see 1 response
    And the response should have text field "Full Name" value "John Doe"

  Scenario: Filter text input responses by contains
    Given I submit a response with text field "Full Name" value "John Doe"
    And I submit a response with text field "Full Name" value "Jane Smith"
    And I submit a response with text field "Full Name" value "John Smith"
    When I filter responses by text field "Full Name" contains "John"
    Then I should see 2 responses
    And all responses should have text field "Full Name" containing "John"

  Scenario: Filter number responses by greater than
    Given I submit a response with number field "Age" value 25
    And I submit a response with number field "Age" value 30
    And I submit a response with number field "Age" value 35
    When I filter responses by number field "Age" greater than 28
    Then I should see 2 responses
    And all responses should have number field "Age" greater than 28

  Scenario: Filter number responses by less than
    Given I submit a response with number field "Age" value 25
    And I submit a response with number field "Age" value 30
    And I submit a response with number field "Age" value 35
    When I filter responses by number field "Age" less than 32
    Then I should see 2 responses
    And all responses should have number field "Age" less than 32

  Scenario: Filter number responses by range
    Given I submit a response with number field "Age" value 25
    And I submit a response with number field "Age" value 30
    And I submit a response with number field "Age" value 35
    And I submit a response with number field "Age" value 40
    When I filter responses by number field "Age" between 28 and 36
    Then I should see 2 responses
    And all responses should have number field "Age" between 28 and 36

  Scenario: Filter email responses by exact match
    Given I submit a response with email field "Email" value "john@example.com"
    And I submit a response with email field "Email" value "jane@example.com"
    And I submit a response with email field "Email" value "admin@example.com"
    When I filter responses by email field "Email" equals "john@example.com"
    Then I should see 1 response
    And the response should have email field "Email" value "john@example.com"

  Scenario: Filter email responses by domain
    Given I submit a response with email field "Email" value "john@example.com"
    And I submit a response with email field "Email" value "jane@test.com"
    And I submit a response with email field "Email" value "admin@example.com"
    When I filter responses by email field "Email" contains "@example.com"
    Then I should see 2 responses
    And all responses should have email field "Email" containing "@example.com"

  Scenario: Filter select field responses by selected option
    Given I submit a response with select field "Country" value "USA"
    And I submit a response with select field "Country" value "Canada"
    And I submit a response with select field "Country" value "USA"
    When I filter responses by select field "Country" equals "USA"
    Then I should see 2 responses
    And all responses should have select field "Country" value "USA"

  Scenario: Filter radio field responses by selected option
    Given I submit a response with radio field "Gender" value "Male"
    And I submit a response with radio field "Gender" value "Female"
    And I submit a response with radio field "Gender" value "Male"
    When I filter responses by radio field "Gender" equals "Male"
    Then I should see 2 responses
    And all responses should have radio field "Gender" value "Male"

  Scenario: Filter checkbox responses by contains option
    Given I submit a response with checkbox field "Interests" values "Sports,Music"
    And I submit a response with checkbox field "Interests" values "Music,Reading"
    And I submit a response with checkbox field "Interests" values "Sports,Gaming"
    When I filter responses by checkbox field "Interests" contains "Music"
    Then I should see 2 responses
    And all responses should have checkbox field "Interests" containing "Music"

  Scenario: Filter date responses by exact date
    Given I submit a response with date field "Birth Date" value "1990-01-15"
    And I submit a response with date field "Birth Date" value "1995-06-20"
    And I submit a response with date field "Birth Date" value "1990-01-15"
    When I filter responses by date field "Birth Date" equals "1990-01-15"
    Then I should see 2 responses
    And all responses should have date field "Birth Date" value "1990-01-15"

  Scenario: Filter date responses by date range
    Given I submit a response with date field "Birth Date" value "1990-01-15"
    And I submit a response with date field "Birth Date" value "1995-06-20"
    And I submit a response with date field "Birth Date" value "2000-12-25"
    When I filter responses by date field "Birth Date" between "1992-01-01" and "1998-12-31"
    Then I should see 1 response
    And the response should have date field "Birth Date" value "1995-06-20"

  Scenario: Filter with multiple conditions (AND logic)
    Given I submit a response with text field "Full Name" value "John Doe" and number field "Age" value 25
    And I submit a response with text field "Full Name" value "John Smith" and number field "Age" value 30
    And I submit a response with text field "Full Name" value "Jane Doe" and number field "Age" value 25
    When I filter responses by text field "Full Name" contains "John" AND number field "Age" greater than 28
    Then I should see 1 response
    And the response should have text field "Full Name" value "John Smith"

  Scenario: Filter with multiple conditions (OR logic)
    Given I submit a response with text field "Full Name" value "John Doe" and number field "Age" value 25
    And I submit a response with text field "Full Name" value "Jane Smith" and number field "Age" value 30
    And I submit a response with text field "Full Name" value "Bob Williams" and number field "Age" value 35
    When I filter responses by text field "Full Name" contains "John" OR number field "Age" equals 30
    Then I should see 2 responses

  Scenario: Filter text area responses by contains
    Given I submit a response with textarea field "Comments" value "This product is amazing and works great!"
    And I submit a response with textarea field "Comments" value "Not satisfied with the service quality"
    And I submit a response with textarea field "Comments" value "Amazing experience, highly recommended"
    When I filter responses by textarea field "Comments" contains "amazing"
    Then I should see 2 responses

  Scenario: Case-insensitive text filtering
    Given I submit a response with text field "Full Name" value "JOHN DOE"
    And I submit a response with text field "Full Name" value "john doe"
    And I submit a response with text field "Full Name" value "John Doe"
    When I filter responses by text field "Full Name" equals "john doe"
    Then I should see 3 responses

  Scenario: Filter empty/null values
    Given I submit a response with text field "Full Name" value "John Doe" and email field "Email" value ""
    And I submit a response with text field "Full Name" value "Jane Smith" and email field "Email" value "jane@example.com"
    When I filter responses by email field "Email" is empty
    Then I should see 1 response
    And the response should have text field "Full Name" value "John Doe"

  Scenario: Filter non-empty values
    Given I submit a response with text field "Full Name" value "John Doe" and email field "Email" value ""
    And I submit a response with text field "Full Name" value "Jane Smith" and email field "Email" value "jane@example.com"
    And I submit a response with text field "Full Name" value "Bob Johnson" and email field "Email" value "bob@example.com"
    When I filter responses by email field "Email" is not empty
    Then I should see 2 responses

  Scenario: Pagination with filters
    Given I submit 15 responses with incrementing age values
    When I filter responses by number field "Age" greater than 20 with page 1 and limit 5
    Then I should see 5 responses on the current page
    And the total filtered count should be 10
    When I filter responses by number field "Age" greater than 20 with page 2 and limit 5
    Then I should see 5 responses on the current page

  Scenario: Sorting filtered results by submission date
    Given I submit a response with text field "Full Name" value "John Doe" at timestamp 1
    And I submit a response with text field "Full Name" value "John Smith" at timestamp 2
    And I submit a response with text field "Full Name" value "John Johnson" at timestamp 3
    When I filter responses by text field "Full Name" contains "John" sorted by "submittedAt" descending
    Then I should see 3 responses in reverse chronological order

  Scenario: Complex filter with mixed field types
    Given I submit response 1 with "Full Name"="Alice Brown", "Age"=28, "Country"="USA", "Interests"="Sports,Music"
    And I submit response 2 with "Full Name"="Bob Smith", "Age"=32, "Country"="Canada", "Interests"="Reading,Gaming"
    And I submit response 3 with "Full Name"="Charlie Davis", "Age"=35, "Country"="USA", "Interests"="Sports,Reading"
    When I filter by "Country" equals "USA" AND "Age" greater than 30 AND "Interests" contains "Sports"
    Then I should see 1 response
    And the response should have text field "Full Name" value "Charlie Davis"
