Feature: Radio Field

  Scenario: Test Radio field with valid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a radio field onto the page
    And I open the radio field settings
    Then I fill the radio field settings with valid data

  Scenario: Test Radio field with comprehensive invalid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a radio field onto the page
    And I open the radio field settings
    Then I test label and hint validation for radio
    And I test options validation for radio
    And I verify save button is disabled with errors
    And I fix all validation errors for radio
    And I verify save button is enabled
    Then I save the radio field settings
