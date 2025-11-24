Feature: Sign in
  Sign in with existing credentials to reach the dashboard

  Scenario: Sign in with valid credentials and save session
    Given I am on the sign in page
    When I sign in with valid credentials
    Then I should see the dashboard
    And I save my session

  Scenario: Create a form from a template
    Given I use my saved session
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a short text field onto the page
    Then I fill the short text field settings with valid data
