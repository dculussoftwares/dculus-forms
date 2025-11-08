@GraphQL @ResponseOps @Critical
Feature: Response Operations
  As a form owner
  I want to query, update, and delete form responses
  So that I can manage submitted data effectively

  Background:
    Given the database is clean
    And an organization owner "owner@test.com" exists with password "StrongPass123!" and organization "Test Org"
    And an active form template named "Contact Template" with 3 fields exists
    And I create a form from template "Contact Template" with title "Survey Form" and description "Data collection form"
    And I publish the created form

  @Smoke
  Scenario: Query form responses with pagination
    Given the form has 25 submitted responses
    When I query responses for the form with page=1 and limit=10
    Then I should receive 10 responses
    And the total count should be 25
    And the total pages should be 3
    When I query responses for the form with page=2 and limit=10
    Then I should receive 10 responses
    And the current page should be 2

  Scenario: Sort responses by submission date descending
    Given the form has 5 responses submitted at different times
    When I query responses sorted by "submittedAt" in "desc" order
    Then the responses should be ordered from newest to oldest

  Scenario: Sort responses by submission date ascending
    Given the form has 5 responses submitted at different times
    When I query responses sorted by "submittedAt" in "asc" order
    Then the responses should be ordered from oldest to newest

  Scenario: Filter responses by field value
    Given the form has 10 responses with various field values
    When I filter responses where field "field-1" contains "test"
    Then I should only receive responses matching that criteria
    And the count should reflect the filtered results

  Scenario: Form owner updates response data
    Given the form has 1 submitted response
    When I update the response data with editReason "Correcting data entry error"
    Then the response should be updated successfully
    And the edit history should show 1 edit
    And hasBeenEdited should be true
    And lastEditedBy should be the current user

  Scenario: Multiple response edits create separate history entries
    Given the form has 1 submitted response
    When I update field "field-1" to "New Value A" with reason "First correction"
    And I update field "field-2" to "New Value B" with reason "Second correction"
    Then the edit history should show 2 separate edits
    And each edit should track which fields changed

  Scenario: User without organization membership cannot update response
    Given another user "outsider@test.com" exists in a different organization "Other Org"
    And the form has 1 submitted response
    When user "outsider@test.com" attempts to update the response
    Then the update should fail with error "permission to edit this response"

  Scenario: Form owner deletes a response
    Given the form has 3 submitted responses
    When I delete the second response
    Then the deletion should succeed
    And the form should have 2 responses remaining
    And the deleted response should not be retrievable

  Scenario: Non-owner cannot delete responses
    Given another user "editor@test.com" exists with password "StrongPass123!" in the same organization
    And I share the form with user "editor@test.com" with "EDITOR" permission using scope "SPECIFIC_MEMBERS"
    And the form has 1 submitted response
    When user "editor@test.com" attempts to delete the response
    Then the deletion should fail with error "need OWNER access to delete"

  Scenario: Retrieve single response by ID with complete details
    Given the form has 3 submitted responses
    When I query the first response by ID
    Then I should receive the complete response data
    And it should include the form ID
    And it should include the submission timestamp
