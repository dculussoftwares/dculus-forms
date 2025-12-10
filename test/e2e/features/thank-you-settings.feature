@thank-you
Feature: Thank You Page Settings

  Background:
    Given I sign in with valid credentials

  @thank-you-default
  Scenario: Form shows default thank you message after submission
    # Create and publish a form
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    # Submit the form and verify default thank you message
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill and submit the thank you test form
    Then I should see the default thank you message

  @thank-you-custom
  Scenario: Form shows custom thank you message after submission
    # Create form
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    # Configure custom thank you message
    When I navigate to the form settings page
    And I click on the thank you section
    And I enable the custom thank you message
    And I set the custom thank you message to "Thank you for your feedback!"
    And I save the thank you settings
    Then the thank you settings should be saved successfully
    # Publish and submit
    When I navigate from settings to the form dashboard
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill and submit the thank you test form
    Then I should see the custom thank you message

  @thank-you-substitution
  Scenario: Form shows field value substitution in thank you message
    # Create form
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    # Configure custom thank you message with field mention
    When I navigate to the form settings page
    And I click on the thank you section
    And I enable the custom thank you message
    And I add a field mention to the thank you message
    And I save the thank you settings
    Then the thank you settings should be saved successfully
    # Publish and submit
    When I navigate from settings to the form dashboard
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill the feedback field with "My amazing feedback"
    And I submit the thank you test form
    Then I should see the submitted value "My amazing feedback" in the thank you message
