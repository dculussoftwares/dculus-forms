Feature: Radio Field

  Scenario: Test Radio field with valid data
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a radio field onto the page
    And I open the radio field settings
    Then I fill the radio field settings with valid data

  Scenario: Test Radio field with comprehensive invalid data
    Given I sign in with valid credentials
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

  @persistence
  Scenario: Verify radio field settings persistence in collaborative builder
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a radio field onto the page
    And I open the radio field settings
    
    # Fill all field settings with test data
    When I fill all radio field settings with test data
    And I save the field settings
    Then the field settings should be saved successfully
    
    # Reload and verify persistence via JSON
    When I reload the collaborative builder page
    Then the collaborative builder should load successfully
    When I click the JSON tab in the sidebar
    Then I should see the JSON schema preview
    And the JSON schema should contain the persisted field settings
