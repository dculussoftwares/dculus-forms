Feature: Sign in
  Sign in with existing credentials to reach the dashboard

  Scenario: Sign in with valid credentials and save session
    Given I am on the sign in page
    When I sign in with valid credentials
    Then I should see the dashboard
    And I save my session

  Scenario: Create a form from a template
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a short text field onto the page
    Then I fill the short text field settings with valid data

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

  Scenario: Validate short text field settings with invalid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a short text field onto the page
    And I open the short text field settings
    Then I test invalid label data
    And I test invalid hint data
    And I test invalid placeholder data
    And I test invalid prefix data
    And I test invalid default value data
    And I test invalid min length data
    And I test invalid max length data
    And I test min greater than max validation
    And I verify all validations work correctly

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

  Scenario: Test Email field with valid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag an email field onto the page
    And I open the email field settings
    Then I fill the email field settings with valid data

  Scenario: Test Email field with comprehensive invalid data
    Given I use my saved session
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

  Scenario: Test Number field with valid data
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a number field onto the page
    And I open the number field settings
    Then I fill the number field settings with valid data

  Scenario: Test Number field with comprehensive invalid data
    Given I use my saved session
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
