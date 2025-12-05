Feature: Dropdown Field Comprehensive Validations

  Scenario: Test Dropdown field with valid data
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a dropdown field onto the page
    And I open the dropdown field settings
    Then I fill the dropdown field settings with valid data

  Scenario: Test Dropdown field with comprehensive invalid data
    Given I sign in with valid credentials
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

  Scenario: Create dropdown field via GraphQL and validate all validations in viewer
    Given I sign in with valid credentials
    When I create a form via GraphQL with dropdown field validations
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
    When I test required validation for dropdown in viewer
    
    # Test 2: Option selection
    When I test dropdown option selection in viewer
    
    # Test 3: Valid submission
    When I fill dropdown field with valid data in viewer
    And I should be able to submit the form in viewer
    Then the validation error summary should not be visible

  @persistence
  Scenario: Verify dropdown field settings persistence in collaborative builder
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a dropdown field onto the page
    And I open the dropdown field settings
    
    # Fill all field settings with test data
    When I fill all dropdown field settings with test data
    And I save the field settings
    Then the field settings should be saved successfully
    
    # Reload and verify persistence via JSON
    When I reload the collaborative builder page
    Then the collaborative builder should load successfully
    When I click the JSON tab in the sidebar
    Then I should see the JSON schema preview
    And the JSON schema should contain the persisted field settings
