Feature: Date Field

  Scenario: Test Date field with valid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a date field onto the page
    And I open the date field settings
    Then I fill the date field settings with valid data

  Scenario: Test Date field with comprehensive invalid data
    Given I am signed in
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a date field onto the page
    And I open the date field settings
    Then I test label and hint validation for date
    And I test min max date validation for date
    And I test default value date validation for date
    And I verify save button is disabled with errors
    And I fix all validation errors for date
    And I verify save button is enabled
    Then I save the date field settings
