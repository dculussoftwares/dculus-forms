Feature: Long Text Field

  Scenario: Test Long Text field with valid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a long text field onto the page
    And I open the long text field settings
    Then I fill the long text field settings with valid data

  Scenario: Test Long Text field with comprehensive invalid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a long text field onto the page
    And I open the long text field settings
    Then I test label and hint validation for long text
    And I test min max length validation for long text
    And I verify save button is disabled with errors
    And I fix all validation errors for long text
    And I verify save button is enabled
    Then I save the long text field settings

  Scenario: Validate long text field settings with invalid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a long text field onto the page
    And I open the long text field settings
    Then I test invalid label data
    And I test invalid hint data
    And I test invalid placeholder data
    And I test invalid default value data
    And I test invalid min length data
    And I test invalid max length data
    And I test min greater than max validation
    And I verify all validations work correctly
