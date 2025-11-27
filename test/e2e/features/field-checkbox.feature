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
