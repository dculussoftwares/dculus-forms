Feature: Form Creation

  Scenario: Create a form from a template
    Given I sign in with valid credentials
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a short text field onto the page
    Then I fill the short text field settings with valid data
