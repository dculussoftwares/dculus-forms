@GraphQL @FormOps @Critical
Feature: Form creation from template
  To spin up new forms quickly
  Organization owners should be able to create forms from reusable templates via GraphQL

  Background:
    Given the database is clean
    And an organization owner "owner@test.com" exists with password "StrongPass123!" and organization "Owner Org"
    And an active form template named "Contact Template" with 3 fields exists

  @Smoke
  Scenario: Owner creates a form from a template
    When I create a form from template "Contact Template" with title "Contact Form" and description "Collect inbound leads"
    Then the form creation response should include the title "Contact Form"
    And the form should belong to my organization
    And the form should not be published by default
    And the form schema should have 3 fields
