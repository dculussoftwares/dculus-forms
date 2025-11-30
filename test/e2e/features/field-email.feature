Feature: Email Field Comprehensive Validations

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

  Scenario: Create email field via GraphQL and validate all validations in viewer
    Given I sign in with valid credentials
    When I create a form via GraphQL with email field validations
    Then I should be on the new form dashboard
    
    # Publish and verify in viewer
    When I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    
    # Test validation error summary section
    When I try to submit with empty fields
    Then I should see the validation error summary section
    And the error summary should contain "Please fix the following errors to continue"
    
    # Test 1: Required validation
    When I test required validation for email in viewer
    
    # Test 2: Email format validation
    When I test email format validation in viewer
    
    # Test 3: Valid submission
    When I fill email field with valid data in viewer
    And I should be able to submit the form in viewer
    Then the validation error summary should not be visible
