Feature: Form Viewer with All Field Types

  Scenario: Create form with all 8 field types and verify viewer loads correctly
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    
    # Add all 8 field types to demonstrate comprehensive coverage
    And I drag a short text field onto the page
    And I fill and save the short text field with label "Short Text Field"
    And I drag a long text field onto the page
    And I fill and save the long text field with label "Long Text Field"
    And I drag an email field onto the page
    And I fill and save the email field with label "Email Field"
    And I drag a number field onto the page
    And I fill and save the number field with label "Number Field"
    And I drag a date field onto the page
    And I fill and save the date field with label "Date Field"
    And I drag a dropdown field onto the page
    And I fill and save the dropdown field with label "Dropdown Field"
    And I drag a radio field onto the page
    And I fill and save the radio field with label "Radio Field"
    And I drag a checkbox field onto the page
    And I fill and save the checkbox field with label "Checkbox Field"
    
    # Publish and verify viewer loads successfully
    When I navigate back to the form dashboard
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
