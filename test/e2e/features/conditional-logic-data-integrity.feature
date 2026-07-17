Feature: Conditional logic submit-strip data integrity

  # The strip is enforced twice — client (PageRenderer.handleFormComplete) and
  # server (apps/backend/src/lib/conditionalStrip.ts). These scenarios cover
  # the surfaces where stripped data matters beyond the response row itself:
  # file uploads, direct-GraphQL bypass, edit tracking, and response copy.

  # A FileUpload field hidden at submit time must not only be stripped from
  # the stored response — its File objects must never reach the /upload REST
  # endpoint at all (uploads happen after the client-side strip gate).
  Scenario: Hidden file upload field is stripped and never hits the upload endpoint
    Given I sign in with valid credentials
    When I create a form via GraphQL with a conditionally hidden file upload field
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    And I start recording viewer upload requests
    Then the viewer field "Attachment" should be hidden
    When I choose viewer radio option "Yes" for "Attach a file?"
    Then the viewer field "Attachment" should be visible
    When I attach a text file to the "strip-file" upload field in the viewer
    And I choose viewer radio option "No" for "Attach a file?"
    Then the viewer field "Attachment" should be hidden
    When I submit the conditional logic form in the viewer
    Then no viewer upload request should have been recorded
    And the stored response should include values for "strip-attach"
    And the stored response should not include values for "strip-file"

  # PRIORITY 1 — regression guard for PR #131. submitResponse is a public
  # mutation; a crafted request that skips the viewer entirely must still have
  # hidden-field and hidden-page values stripped server-side.
  Scenario: Server strips hidden values from a direct GraphQL submission bypassing the client
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic rules
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    And I submit a crafted response with hidden field values directly via GraphQL
    Then the stored response should include values for "cond-show-bonus, cond-skip-details, cond-contact"
    And the stored response should not include values for "cond-bonus, cond-details"

  # Editing a response so that a previously answered field becomes hidden must
  # strip its value AND record the removal as a DELETE field change in the
  # response edit history (updateResponse flows through the same strip gate).
  Scenario: Editing a response to hide an answered field records a DELETE change
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic rules
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    And I choose viewer radio option "Yes" for "Show bonus field?"
    And I fill the viewer input "cond-bonus" with "value to be deleted"
    And I choose viewer radio option "No" for "Skip details page?"
    And I click next in the viewer
    And I fill the viewer input "cond-details" with "details kept"
    And I click next in the viewer
    And I fill the viewer input "cond-contact" with "contact kept"
    And I submit the conditional logic form in the viewer
    Then the stored response should include values for "cond-bonus"
    When I open the latest response in edit mode
    And I choose edit-mode radio option "No" for "Show bonus field?"
    And I save the response edit
    Then the stored response should not include values for "cond-bonus"
    And the response edit history should record a "DELETE" change for "cond-bonus"

  # "Send me a copy" configured against a conditionally hidden email field:
  # the submission must succeed and the stored data must lack the email key
  # (which is the gate that prevents any copy email from being attempted).
  Scenario: Send-me-a-copy with a conditionally hidden email field submits cleanly
    Given I sign in with valid credentials
    When I create a form via GraphQL with a conditionally hidden response copy email field
    And I enable respondent-choice response copy for the "copy-email" field
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then the viewer field "Copy Email" should be hidden
    When I choose viewer radio option "Yes" for "Provide an email?"
    Then the viewer field "Copy Email" should be visible
    When I fill the viewer input "copy-email" with "respondent@example.com"
    And I fill the viewer input "copy-note" with "note kept"
    And I choose viewer radio option "No" for "Provide an email?"
    Then the viewer field "Copy Email" should be hidden
    When I tick the send-me-a-copy checkbox in the viewer
    And I submit the conditional logic form in the viewer
    Then the viewer should show the thank you screen without a copy notice
    And the stored response should include values for "copy-toggle, copy-note"
    And the stored response should not include values for "copy-email"

  # "Keep while filling": hiding a field must not wipe what was typed — after
  # navigating away and back and re-showing the field, the value is restored.
  Scenario: Re-showing a hidden field restores the typed value across page navigation
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic rules
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    And I choose viewer radio option "Yes" for "Show bonus field?"
    And I fill the viewer input "cond-bonus" with "sticky bonus value"
    And I choose viewer radio option "No" for "Show bonus field?"
    Then the viewer field "Bonus Field" should be hidden
    When I choose viewer radio option "No" for "Skip details page?"
    And I click next in the viewer
    Then the viewer field "Details Text" should be visible
    When I click previous in the viewer
    And I choose viewer radio option "Yes" for "Show bonus field?"
    Then the viewer field "Bonus Field" should be visible
    And the viewer input "cond-bonus" should have value "sticky bonus value"
