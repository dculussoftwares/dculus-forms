Feature: Form Viewer Multi-Page Navigation via GraphQL

  Scenario: Create multi-page form via GraphQL and verify page navigation in viewer
    Given I sign in with valid credentials
    When I create a form via GraphQL with all field types
    Then I should be on the new form dashboard
    
    # Publish and verify in viewer
    When I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    
    # Wait for form to fully load (L9 layout renders directly to pages)
    # Verify page 1 - Text Fields
    And I should be on viewer page 1 of 3
    And I should see field "Short Text Field" on the current page
    And I should see field "Long Text Field" on the current page
    
    # Navigate to page 2 - Input Fields
    When I click next in the viewer
    Then I should be on viewer page 2 of 3
    And I should see field "Email Field" on the current page
    And I should see field "Number Field" on the current page
    And I should see field "Date Field" on the current page
    
    # Navigate to page 3 - Selection Fields
    When I click next in the viewer
    Then I should be on viewer page 3 of 3
    And I should see field "Dropdown Field" on the current page
    And I should see field "Radio Field" on the current page
    And I should see field "Checkbox Field" on the current page
    
    # Verify backward navigation
    When I click previous in the viewer
    Then I should be on viewer page 2 of 3
    When I click previous in the viewer
    Then I should be on viewer page 1 of 3
