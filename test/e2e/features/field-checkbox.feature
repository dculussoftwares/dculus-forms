Feature: Checkbox Field

  Scenario: Test Checkbox field with valid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a checkbox field onto the page
    And I open the checkbox field settings
    Then I fill the checkbox field settings with valid data

  Scenario: Test Checkbox field with invalid selection limits
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a checkbox field onto the page
    And I open the checkbox field settings
    Then I test selection limits validation for checkbox

  Scenario: Test Checkbox field with comprehensive invalid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a checkbox field onto the page
    And I open the checkbox field settings
    Then I test label and hint validation for checkbox
    And I test options validation for checkbox
    And I verify save button is disabled with errors
    And I fix all validation errors for checkbox
    And I verify save button is enabled
    Then I save the checkbox field settings

