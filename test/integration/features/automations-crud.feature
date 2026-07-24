@GraphQL @Automations @Critical
Feature: Automations GraphQL API — CRUD lifecycle
  As a form owner
  I want to create, edit, activate, list, and delete automations via the GraphQL API
  So that I can build and manage workflows for my form

  Background:
    Given the database is clean
    And an organization owner "automation-owner@test.com" exists with password "StrongPass123!" and organization "Automation CRUD Org"
    And another user "automation-viewer@test.com" exists with password "StrongPass123!" in the same organization
    And another user "automation-outsider@test.com" exists with password "StrongPass123!" in a different organization "Other Automation Org"
    And an active form template named "Automation CRUD Template" with 2 fields exists
    And I create a form from template "Automation CRUD Template" with title "Automation CRUD Form" and description "Form for automation CRUD tests"

  @Smoke
  Scenario: Full CRUD lifecycle — create, read, update, activate, list, delete
    When I create an automation named "Welcome Email" with trigger type "form.submitted" on the form
    Then the automation should be created with status "DRAFT" and version 1
    When I query the automation by ID
    Then the automation name should be "Welcome Email"
    When I update the automation graph to a single-action webhook automation
    Then the automation version should be 2
    When I set the automation status to "ACTIVE"
    Then the automation status should be "ACTIVE"
    When I query automations for the form
    Then I should see 1 automation in the results
    When I delete the automation
    Then the automation should no longer exist

  Scenario: Activation is blocked when the graph is invalid, with structured validation errors
    Given I create an automation named "Broken Flow" with trigger type "form.submitted" on the form
    And I update the automation graph to an invalid graph with an orphan node
    When I try to set the automation status to "ACTIVE"
    Then the operation should fail with error "AUTOMATION_INVALID_GRAPH"
    And the validation errors should include code "ORPHAN_NODE"
    And the automation status should be "DRAFT"

  Scenario: Updating only the name does not bump the version
    Given I create an automation named "Rename Me" with trigger type "form.submitted" on the form
    When I update the automation name to "Renamed Automation"
    Then the automation version should be 1
    And the automation name should be "Renamed Automation"

  Scenario: Listing runs for an automation
    Given I create an automation named "Runs List Test" with trigger type "form.submitted" on the form
    And a RUNNING run exists for the automation
    And a RUNNING run exists for the automation
    When I query runs for the automation
    Then I should see 2 runs in the results

  Scenario: A user outside the organization cannot manage automations
    Given I switch to user "automation-outsider@test.com"
    When I try to create an automation named "Should Fail" with trigger type "form.submitted" on the form
    Then the operation should fail with error "Access denied"

  Scenario: A VIEWER can list automations but cannot create one
    Given I share the form with user "automation-viewer@test.com" with "VIEWER" permission using scope "SPECIFIC_MEMBERS"
    And I create an automation named "Viewer Read Test" with trigger type "form.submitted" on the form
    When I switch to user "automation-viewer@test.com"
    And I query automations for the form
    Then I should see 1 automation in the results
    When I try to create an automation named "Viewer Write Attempt" with trigger type "form.submitted" on the form
    Then the operation should fail with error "Access denied"
