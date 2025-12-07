@filter
Feature: Response Table Filters

  Background:
    Given I sign in with valid credentials

  Scenario: Setup filter test - Create form and submit responses
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    # Publish the form
    When I publish the form
    Then the form should be published
    When I get the form short URL
    # Submit 5 responses with varied data
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    # Navigate to responses page
    When I navigate to the responses page
    Then I should see 5 responses in the table

  Scenario: Filter Short Text - CONTAINS operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply CONTAINS filter
    When I open the filter modal
    And I add a filter for field "Text Field" with operator "contains" and value "Hello"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Short Text - EQUALS operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply EQUALS filter
    When I open the filter modal
    And I add a filter for field "Text Field" with operator "equals" and value "Hello"
    And I apply the filters
    Then I should see 1 responses in the table

  Scenario: Filter Short Text - STARTS_WITH operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply STARTS_WITH filter
    When I open the filter modal
    And I add a filter for field "Text Field" with operator "starts with" and value "Hello"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Short Text - ENDS_WITH operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply ENDS_WITH filter
    When I open the filter modal
    And I add a filter for field "Text Field" with operator "ends with" and value "World"
    And I apply the filters
    Then I should see 3 responses in the table

  Scenario: Filter Short Text - IS_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Text Field" with operator "is empty"
    And I apply the filters
    Then I should see 1 responses in the table

  Scenario: Filter Short Text - IS_NOT_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_NOT_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Text Field" with operator "is not empty"
    And I apply the filters
    Then I should see 4 responses in the table

  Scenario: Filter Number - EQUALS operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply EQUALS filter
    When I open the filter modal
    And I add a filter for field "Number Field" with operator "equals" and value "100"
    And I apply the filters
    Then I should see 1 responses in the table

  Scenario: Filter Number - GREATER_THAN operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply GREATER_THAN filter
    When I open the filter modal
    And I add a filter for field "Number Field" with operator "greater than" and value "100"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Number - LESS_THAN operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply LESS_THAN filter
    When I open the filter modal
    And I add a filter for field "Number Field" with operator "less than" and value "100"
    And I apply the filters
    Then I should see 1 responses in the table

  Scenario: Filter Number - BETWEEN operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply BETWEEN filter
    When I open the filter modal
    And I add a filter for field "Number Field" with operator "between" and range 50 to 150
    And I apply the filters
    Then I should see 3 responses in the table

  Scenario: Filter Number - IS_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Number Field" with operator "is empty"
    And I apply the filters
    Then I should see 1 responses in the table

  Scenario: Filter Number - IS_NOT_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response 1 with text "Hello World" and number 100
    And I submit response 2 with text "Hello" and number 50
    And I submit response 3 with text "World" and number 200
    And I submit response 4 with empty text and empty number
    And I submit response 5 with text "Goodbye World" and number 150
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_NOT_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Number Field" with operator "is not empty"
    And I apply the filters
    Then I should see 4 responses in the table
  # ==================== DATE FIELD FILTERS ====================

  Scenario: Filter Date - DATE_EQUALS operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "Response 1" number 100 and date "2024-01-15"
    And I submit response with text "Response 2" number 50 and date "2024-01-20"
    And I submit response with text "Response 3" number 200 and date "2024-02-10"
    And I submit response with text "Response 4" number 75 and empty date
    And I submit response with text "Response 5" number 150 and date "2024-01-15"
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply DATE_EQUALS filter - should find responses with 2024-01-15
    When I open the filter modal
    And I add a filter for field "Date Field" with operator "equals" and date "2024-01-15"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Date - DATE_BEFORE operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "Response 1" number 100 and date "2024-01-15"
    And I submit response with text "Response 2" number 50 and date "2024-01-20"
    And I submit response with text "Response 3" number 200 and date "2024-02-10"
    And I submit response with text "Response 4" number 75 and empty date
    And I submit response with text "Response 5" number 150 and date "2024-01-10"
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply DATE_BEFORE filter - should find dates before 2024-01-20
    When I open the filter modal
    And I add a filter for field "Date Field" with operator "before" and date "2024-01-20"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Date - DATE_AFTER operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "Response 1" number 100 and date "2024-01-15"
    And I submit response with text "Response 2" number 50 and date "2024-01-20"
    And I submit response with text "Response 3" number 200 and date "2024-02-10"
    And I submit response with text "Response 4" number 75 and empty date
    And I submit response with text "Response 5" number 150 and date "2024-01-10"
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply DATE_AFTER filter - should find dates after 2024-01-15
    When I open the filter modal
    And I add a filter for field "Date Field" with operator "after" and date "2024-01-15"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Date - DATE_BETWEEN operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "Response 1" number 100 and date "2024-01-15"
    And I submit response with text "Response 2" number 50 and date "2024-01-20"
    And I submit response with text "Response 3" number 200 and date "2024-02-10"
    And I submit response with text "Response 4" number 75 and empty date
    And I submit response with text "Response 5" number 150 and date "2024-01-10"
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply DATE_BETWEEN filter - dates between 2024-01-10 and 2024-01-20 inclusive
    When I open the filter modal
    And I add a filter for field "Date Field" with operator "between" and date range "2024-01-10" to "2024-01-20"
    And I apply the filters
    Then I should see 3 responses in the table

  Scenario: Filter Date - IS_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "Response 1" number 100 and date "2024-01-15"
    And I submit response with text "Response 2" number 50 and date "2024-01-20"
    And I submit response with text "Response 3" number 200 and date "2024-02-10"
    And I submit response with text "Response 4" number 75 and empty date
    And I submit response with text "Response 5" number 150 and date "2024-01-10"
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Date Field" with operator "is empty"
    And I apply the filters
    Then I should see 1 responses in the table

  Scenario: Filter Date - IS_NOT_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "Response 1" number 100 and date "2024-01-15"
    And I submit response with text "Response 2" number 50 and date "2024-01-20"
    And I submit response with text "Response 3" number 200 and date "2024-02-10"
    And I submit response with text "Response 4" number 75 and empty date
    And I submit response with text "Response 5" number 150 and date "2024-01-10"
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_NOT_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Date Field" with operator "is not empty"
    And I apply the filters
    Then I should see 4 responses in the table
  # ==================== DROPDOWN FIELD FILTERS ====================

  Scenario: Filter Dropdown - IN operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "R1" number 10 and dropdown "red"
    And I submit response with text "R2" number 20 and dropdown "green"
    And I submit response with text "R3" number 30 and dropdown "blue"
    And I submit response with text "R4" number 40 and dropdown "red"
    And I submit response with text "R5" number 50 and empty dropdown
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IN filter - responses with "red" OR "green"
    When I open the filter modal
    And I add a filter for field "Dropdown Field" with operator "includes" and options "Red,Green"
    And I apply the filters
    Then I should see 3 responses in the table

  Scenario: Filter Dropdown - NOT_IN operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "R1" number 10 and dropdown "red"
    And I submit response with text "R2" number 20 and dropdown "green"
    And I submit response with text "R3" number 30 and dropdown "blue"
    And I submit response with text "R4" number 40 and dropdown "red"
    And I submit response with text "R5" number 50 and empty dropdown
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply NOT_IN filter - responses NOT with "red" OR "green" (so blue + empty)
    When I open the filter modal
    And I add a filter for field "Dropdown Field" with operator "not includes" and options "Red,Green"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Dropdown - IS_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "R1" number 10 and dropdown "red"
    And I submit response with text "R2" number 20 and dropdown "green"
    And I submit response with text "R3" number 30 and dropdown "blue"
    And I submit response with text "R4" number 40 and dropdown "red"
    And I submit response with text "R5" number 50 and empty dropdown
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Dropdown Field" with operator "is empty"
    And I apply the filters
    Then I should see 1 responses in the table

  Scenario: Filter Dropdown - IS_NOT_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with text "R1" number 10 and dropdown "red"
    And I submit response with text "R2" number 20 and dropdown "green"
    And I submit response with text "R3" number 30 and dropdown "blue"
    And I submit response with text "R4" number 40 and dropdown "red"
    And I submit response with text "R5" number 50 and empty dropdown
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_NOT_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Dropdown Field" with operator "is not empty"
    And I apply the filters
    Then I should see 4 responses in the table
  # ==================== CHECKBOX FIELD FILTERS ====================

  Scenario: Filter Checkbox - IN operator (Includes any)
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with checkbox "Apple"
    And I submit response with checkbox "Banana"
    And I submit response with checkbox "Apple,Cherry"
    And I submit response with checkbox "Banana,Cherry"
    And I submit response with empty checkbox
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IN filter - responses containing "Apple" OR "Cherry"
    When I open the filter modal
    And I add a filter for field "Checkbox Field" with operator "includes any" and options "Apple,Cherry"
    And I apply the filters
    Then I should see 3 responses in the table

  Scenario: Filter Checkbox - IS_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with checkbox "Apple"
    And I submit response with checkbox "Banana"
    And I submit response with checkbox "Apple,Cherry"
    And I submit response with checkbox "Banana,Cherry"
    And I submit response with empty checkbox
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Checkbox Field" with operator "is empty"
    And I apply the filters
    Then I should see 1 responses in the table

  Scenario: Filter Checkbox - IS_NOT_EMPTY operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with checkbox "Apple"
    And I submit response with checkbox "Banana"
    And I submit response with checkbox "Apple,Cherry"
    And I submit response with checkbox "Banana,Cherry"
    And I submit response with empty checkbox
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply IS_NOT_EMPTY filter
    When I open the filter modal
    And I add a filter for field "Checkbox Field" with operator "is not empty"
    And I apply the filters
    Then I should see 4 responses in the table

  Scenario: Filter Checkbox - NOT_IN operator (Does not include any)
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with checkbox "Apple"
    And I submit response with checkbox "Banana"
    And I submit response with checkbox "Apple,Cherry"
    And I submit response with checkbox "Banana,Cherry"
    And I submit response with empty checkbox
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply NOT_IN filter - responses NOT containing "Apple" OR "Cherry"
    When I open the filter modal
    And I add a filter for field "Checkbox Field" with operator "does not include any" and options "Apple,Cherry"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Checkbox - CONTAINS_ALL operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with checkbox "Apple"
    And I submit response with checkbox "Banana"
    And I submit response with checkbox "Apple,Cherry"
    And I submit response with checkbox "Apple,Banana,Cherry"
    And I submit response with empty checkbox
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply CONTAINS_ALL filter - responses containing BOTH "Apple" AND "Cherry"
    When I open the filter modal
    And I add a filter for field "Checkbox Field" with operator "contains all" and options "Apple,Cherry"
    And I apply the filters
    Then I should see 2 responses in the table

  Scenario: Filter Checkbox - EQUALS operator
    When I create a form via GraphQL for filter testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    When I submit response with checkbox "Apple"
    And I submit response with checkbox "Apple,Cherry"
    And I submit response with checkbox "Apple,Banana,Cherry"
    And I submit response with checkbox "Apple"
    And I submit response with empty checkbox
    When I navigate to the responses page
    Then I should see 5 responses in the table
    # Apply EQUALS filter - responses with exactly "Apple" only
    When I open the filter modal
    And I add a filter for field "Checkbox Field" with operator "equals" and options "Apple"
    And I apply the filters
    Then I should see 2 responses in the table
