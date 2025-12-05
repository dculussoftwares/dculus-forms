Feature: Short Text Field Comprehensive Validations

  Scenario: Validate short text field settings with invalid data in builder
    Given I sign in with valid credentials
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

  Scenario: Create short text field via GraphQL and validate all validations in viewer
    Given I sign in with valid credentials
    When I create a form via GraphQL with short text field validations
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
    When I test required validation for short text in viewer
    
    # Test 2: Min length validation
    When I test min length validation for short text in viewer
    
    # Test 3: Max length validation
    When I test max length validation for short text in viewer
    
    # Test 4: Valid submission
    When I fill short text field with valid data in viewer
    And I should be able to submit the form in viewer
    Then the validation error summary should not be visible

  Scenario: Verify short text field settings persistence in collaborative builder
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a short text field onto the page
    And I open the short text field settings
    
    # Fill all field settings with test data
    When I fill all short text field settings with test data
    And I save the field settings
    Then the field settings should be saved successfully
    
    # Reload and verify persistence via JSON
    When I reload the collaborative builder page
    Then the collaborative builder should load successfully
    When I click the JSON tab in the sidebar
    Then I should see the JSON schema preview
    And the JSON schema should contain the persisted field settings

