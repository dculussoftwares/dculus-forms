@submission-limits
Feature: Submission Limits (Maximum Responses and Time Window)

  Background:
    Given I sign in with valid credentials

  @max-responses
  Scenario: Form blocks submissions when maximum responses limit is reached
    # Create a form with a simple field via GraphQL
    When I create a form via GraphQL with max responses settings
    Then I should be on the new form dashboard
    # Navigate to settings and enable max responses limit
    When I navigate to the form settings page
    And I click on the submission limits section
    And I enable the maximum responses limit
    And I set the maximum responses limit to 1
    And I save the submission limits settings
    Then the submission limits should be saved successfully
    # Publish the form
    When I navigate from settings to the form dashboard
    And I publish the form
    Then the form should be published
    # Submit the first response (should succeed)
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill and submit the max responses test form
    Then the form submission should succeed
    # Try to submit a second response (should be blocked)
    When I navigate to the form viewer with the short URL in a new context
    Then I should see the max responses error message

  @time-window
  Scenario: Form blocks submissions when outside time window (past end date)
    # Create a form with a simple field via GraphQL
    When I create a form via GraphQL with max responses settings
    Then I should be on the new form dashboard
    # Navigate to settings and enable time window with past end date
    When I navigate to the form settings page
    And I click on the submission limits section
    And I enable the time window
    And I set the time window to past dates
    And I save the submission limits settings
    Then the submission limits should be saved successfully
    # Publish the form
    When I navigate from settings to the form dashboard
    And I publish the form
    Then the form should be published
    # Try to submit (should be blocked because time window has ended)
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the time window ended error message

  @combined-limits
  Scenario: Form blocks submissions when both max responses and time window are enabled
    # Create a form with a simple field via GraphQL
    When I create a form via GraphQL with max responses settings
    Then I should be on the new form dashboard
    # Navigate to settings and enable both limits
    When I navigate to the form settings page
    And I click on the submission limits section
    And I enable the maximum responses limit
    And I set the maximum responses limit to 1
    And I enable the time window
    And I set the time window to current active dates
    And I save the submission limits settings
    Then the submission limits should be saved successfully
    # Publish the form
    When I navigate from settings to the form dashboard
    And I publish the form
    Then the form should be published
    # Submit the first response (should succeed - within time window and under limit)
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill and submit the max responses test form
    Then the form submission should succeed
    # Try to submit a second response (should be blocked by max responses limit)
    When I navigate to the form viewer with the short URL in a new context
    Then I should see the max responses error message
