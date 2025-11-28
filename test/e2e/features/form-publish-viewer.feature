Feature: Form Publishing and Viewer Accessibility

  Scenario: Publish form and verify it is accessible in the form viewer
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer

  Scenario: Verify unpublished form is not accessible in the form viewer
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then the form viewer should show an error
