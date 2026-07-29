@automations
Feature: Automations linear happy path
  End-to-end coverage for a single webhook-action automation: build it, activate it,
  trigger it via a real form submission, and confirm the run completes successfully.
  Also covers the builder-embed migration (#233): automations now live at
  /builder/automations/* inside the builder shell, and the old standalone
  /dashboard/form/:formId/automations/* routes redirect there.

  Scenario: Build, activate, trigger, and observe a webhook automation run
    Given I sign in with valid credentials
    And I create a form via GraphQL for the automations happy path
    When I publish the form
    Then the form should be published
    When I open the automations tab
    And I navigate directly to the old automations list URL
    Then the URL should redirect to the automations list in the builder
    And I create an automation named "Welcome flow"
    Then I should be in the automation builder
    When I navigate directly to the old automation builder URL
    Then the URL should redirect to the automation builder tab
    And I should be in the automation builder
    When I add a webhook action step
    Then the action node should show the setup required badge
    When I close the node config panel
    And I save the automation graph
    And I try to activate the automation
    Then the automation should still be in Draft status
    When I configure the webhook action with a test delivery URL
    And I save the automation graph
    And I activate the automation
    Then the automation status should be Active
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    And I fill and submit the automations happy path form
    Then the viewer should show the thank you screen
    When I open the automation runs view
    And I navigate directly to the old automation runs URL
    Then the URL should redirect to the automation runs tab
    Then a run should reach COMPLETED status
    And the run's webhook action step should show SUCCESS
