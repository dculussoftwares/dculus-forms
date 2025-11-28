Feature: Email Field

  Scenario: Test Email field with valid data
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag an email field onto the page
    And I open the email field settings
    Then I fill the email field settings with valid data

  Scenario: Test Email field with comprehensive invalid data
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag an email field onto the page
    And I open the email field settings
    Then I test label and hint validation for email
    And I test placeholder validation for email
    And I test default value validation for email
    And I verify save button is disabled with errors
    And I fix all validation errors for email
    And I verify save button is enabled
    Then I save the email field settings
