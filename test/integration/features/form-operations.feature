@GraphQL @FormOps @Critical
Feature: Form Operations
  As a form owner or editor
  I want to manage forms
  So that I can update, duplicate, and delete forms

  Background:
    Given the database is clean
    And an organization owner "owner@test.com" exists with password "StrongPass123!" and organization "Test Org"
    And an active form template named "Contact Template" with 3 fields exists
    And I create a form from template "Contact Template" with title "Test Form" and description "Test Description"

  @Smoke
  Scenario: Owner updates form title and description
    When I update the form title to "Updated Form" and description to "Updated Description"
    Then the form should have title "Updated Form"
    And the form should have description "Updated Description"

  Scenario: Owner publishes a form
    Given the form is not published
    When I publish the form
    Then the form should be published
    And the form should be accessible via short URL

  Scenario: Owner unpublishes a form
    Given I publish the form
    When I unpublish the form
    Then the form should not be published
    And public users should not be able to access the form

  Scenario: Owner updates submission limits
    When I set max responses to 50
    Then the form settings should show max responses of 50
    When I set a time window from "2025-01-01" to "2025-12-31"
    Then the form settings should show the time window

  Scenario: Owner duplicates a form with responses
    Given I publish the form
    And a public user submits a response to the form
    When I duplicate the form with title "Test Form (Copy)"
    Then a new form should be created with title "Test Form (Copy)"
    And the new form should have the same schema as the original
    And the new form should have 0 responses
    And the new form should have a different short URL

  Scenario: Owner regenerates short URL
    Given I publish the form
    And I note the current short URL
    When I regenerate the short URL
    Then the form should have a different short URL
    And the old short URL should not work

  Scenario: Owner deletes a form with responses
    Given I publish the form
    And a public user submits a response to the form
    When I delete the form
    Then the form should not exist in the database
    And the form responses should be deleted

  # TODO: Implement form sharing scenarios
  # Scenario: Editor can update form but not delete
  # Scenario: Viewer cannot edit form
  # Scenario: Query form by ID with proper permissions

  Scenario: Query form by shortUrl (public access)
    Given I publish the form
    When a public user queries the form by short URL
    Then the public user should receive the form data
    When I unpublish the form
    And a public user queries the form by short URL
    Then the query should fail with error "Form is not published"

  Scenario: Form metadata is computed correctly
    When I query the form metadata
    Then the metadata should show pageCount of 1
    And the metadata should show fieldCount of 3
    And the metadata should have a lastUpdated timestamp

  # Note: organizationId and createdById are immutable by design
  # These fields are not exposed in UpdateFormInput GraphQL schema
  # Scenario: Cannot change form organizationId
  # Scenario: Cannot change form createdById

  Scenario: Form with background image is duplicated correctly
    Given the form template has a background image
    When I duplicate the form with title "Test Form (Copy)"
    Then the new form should have a copied background image
    And the new form background image should have a unique key
