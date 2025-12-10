@max-responses
Feature: Maximum Responses Limit

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
    When I fill and submit the max responses test form
    Then the form submission should succeed
    # Try to submit a second response (should be blocked)
    When I navigate to the form viewer with the short URL in a new context
    Then I should see the max responses error message
