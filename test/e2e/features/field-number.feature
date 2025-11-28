Feature: Number Field

  Scenario: Test Number field with valid data
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a number field onto the page
    And I open the number field settings
    Then I fill the number field settings with valid data

  Scenario: Test Number field with comprehensive invalid data
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a number field onto the page
    And I open the number field settings
    Then I test label validation for number
    And I test min max value validation for number
    And I test default value range validation for number
    And I verify save button is disabled with errors
    And I fix all validation errors for number
    And I verify save button is enabled
    Then I save the number field settings
