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

  @Smoke
  Scenario: Owner creates a form directly from schema
    When I create a form directly from schema with title "Schema-Based Form"
    Then the form creation response should include the title "Schema-Based Form"
    And the form should belong to my organization
    And the form should not be published by default
    And the form schema should have 2 fields

  Scenario: Creating form with both templateId and formSchema should fail
    When I attempt to create a form with both templateId and formSchema
    Then the form creation should fail with error "Cannot provide both templateId and formSchema"

  Scenario: Creating form with neither templateId nor formSchema should fail
    When I attempt to create a form with neither templateId nor formSchema
    Then the form creation should fail with error "Either templateId or formSchema must be provided"
