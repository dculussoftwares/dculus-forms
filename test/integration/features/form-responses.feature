@GraphQL @Responses @Critical
Feature: Form response submissions
  To collect answers from end users
  Published forms must accept submissions while drafts stay protected

  Background:
    Given the database is clean
    And an organization owner "owner@test.com" exists with password "StrongPass123!" and organization "Owner Org"
    And an active form template named "Contact Template" with 3 fields exists
    And I create a form from template "Contact Template" with title "Lead Capture" and description "Collect inbound leads"
    And I publish the created form

  @Smoke
  Scenario: Public user submits a response to a published form
    When a public user submits a response to the published form
    Then the submission should succeed with thank you message "Thank you! Your form has been submitted successfully."
    And the form should have 1 stored responses
    And the stored response data should match the submitted payload

  Scenario: Draft form should reject submissions
    Given I create an unpublished form from template "Contact Template" with title "Draft Only"
    When a public user attempts to submit a response to the unpublished form titled "Draft Only"
    Then the submission should fail with error "Failed to submit response: Form is not published and cannot accept responses"

  Scenario: Submission limit prevents additional responses
    Given I set the submission limit to 1 response on the published form
    When a public user submits a response to the published form
    And another public user attempts to submit a response to the published form
    Then the submission should fail with error "Failed to submit response: Form has reached its maximum response limit"

  Scenario: Custom thank you message renders with field data
    Given I configure a custom thank you message "Thank you {{field-1}} for reaching out!" on the published form
    When a public user submits a response to the published form
    Then the custom thank you message should render with submitted data
