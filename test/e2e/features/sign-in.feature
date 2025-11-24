Feature: Sign in
  Sign in with existing credentials to reach the dashboard

  Scenario: Sign in with valid credentials
    Given I am on the sign in page
    When I sign in with valid credentials
    Then I should see the dashboard

  Scenario: Create a form from a template
    Given I am signed in
    When I create a form from the first template
    Then I should be on the new form dashboard
