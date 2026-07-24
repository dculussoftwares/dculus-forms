@automations
Feature: Automation trigger service
  As a form owner
  I want an ACTIVE automation to run automatically when my form is submitted
  So that a single-action workflow (e.g. calling a webhook) completes without manual intervention

  Scenario: A form submission drives a single-action automation run to COMPLETED
    Given I am logged in as "automation-trigger-test@example.com" with password "testpass123"
    And I create an organization with name "Automation Org" and slug "automation-org-test"
    And I create a published form for automation testing titled "Automation Test Form"
    And I create an ACTIVE single-action automation on that form that calls the mock webhook server
    When I submit a response to that form with field "Name" value "Ada Lovelace"
    Then an automation run for that automation should reach status "COMPLETED" within 20 seconds
    And the mock webhook server should have received a request for that form's submission
