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
