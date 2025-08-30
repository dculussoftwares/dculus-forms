@DragNewField @FieldProperties 
Feature: Drag New Field and Configure Settings
  This feature specifically tests dragging a brand new field from the sidebar
  and ensuring its settings can be configured properly.

  Background:
    Given I have test credentials ready
    And I am signed in as a new user

  @NewFieldDrag
  Scenario: Drag new Short Text field and configure character limits
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Blank Form" template
    And I fill in the form creation details:
      | Field Name  | Value                      |
      | Form Title  | Test Drag New Field        |
      | Description | Testing new field drag     |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    
    # Drag a brand new Short Text field from sidebar
    When I drag "Short Text" field from the sidebar to the form
    And I click on the newly added field to select it
    Then I should see the field settings panel
    
    # Configure field settings
    When I set the field label to "Test Field"
    And I set the minimum length to "5"
    And I set the maximum length to "100"
    And I click the Save button in field settings
    
    # Verify settings are applied
    Then the character limits should be saved successfully
    And I should see character count indicators in the form preview
    
    # Verify persistence after refresh
    When I refresh the page
    Then I should see the collaborative form builder interface
    When I click on the newly added field to select it
    Then the minimum length should be "5"
    And the maximum length should be "100"
    And the field label should be "Test Field"