Feature: Dropdown Field

  Scenario: Test Dropdown field with valid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a dropdown field onto the page
    And I open the dropdown field settings
    Then I fill the dropdown field settings with valid data

  Scenario: Test Dropdown field with comprehensive invalid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a dropdown field onto the page
    And I open the dropdown field settings
    Then I test label and hint validation for dropdown
    And I test options validation for dropdown
    And I verify save button is disabled with errors
    And I fix all validation errors for dropdown
    And I verify save button is enabled
    Then I save the dropdown field settings
