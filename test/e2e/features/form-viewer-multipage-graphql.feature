@form-viewer-multipage-graphql
Feature: Form Viewer Multi-Page Navigation via GraphQL

  Background:
    Given I sign in with valid credentials

  @form-viewer-multipage-graphql
  Scenario: Create multi-page form via GraphQL and verify page navigation in viewer
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

  @form-viewer-multipage-graphql @required-field-blocks-next
  Scenario: Required field on page 1 prevents advancing to page 2 until filled
    When I create a form via GraphQL with required field on first page
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    And I should be on viewer page 1 of 2

    # Attempt to advance without filling the required field
    When I click next in the viewer
    Then I should still be on viewer page 1
    And I should see a required field error in the viewer

    # Fill the required field and advance
    When I fill the required short text field in the viewer
    And I click next in the viewer
    Then I should be on viewer page 2 of 2

  @form-viewer-multipage-graphql @full-submission
  Scenario: Fill all field types across 3 pages and submit successfully
    When I create a form via GraphQL with all field types
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    And I should be on viewer page 1 of 3

    # Fill page 1 — text fields
    When I fill the all-field-types form on page 1
    And I click next in the viewer
    Then I should be on viewer page 2 of 3

    # Fill page 2 — input fields
    When I fill the all-field-types form on page 2
    And I click next in the viewer
    Then I should be on viewer page 3 of 3

    # Fill page 3 — selection fields — and submit
    When I fill the all-field-types form on page 3
    And I submit the viewer form
    Then the viewer should show the thank you screen
