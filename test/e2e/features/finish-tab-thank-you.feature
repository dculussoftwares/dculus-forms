@finish-tab
Feature: Finish Tab - Thank You Page Settings

  Replaces thank-you-settings.feature's settings-page-driven scenarios now that
  Thank You configuration lives on the builder's Finish tab instead of the
  standalone Settings page (see epic #170, issue #166).

  Background:
    Given I sign in with valid credentials

  @finish-tab-default
  Scenario: Form shows default thank you message after submission
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill and submit the thank you test form
    Then I should see the default thank you message

  @finish-tab-custom
  Scenario: Form shows custom thank you message configured from the Finish tab
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I click on the finish tab
    And I enable the custom thank you message
    And I set the custom thank you message to "Thank you for your feedback!"
    And I save the thank you settings
    Then the thank you settings should be saved successfully
    When I navigate from the builder to the form dashboard
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill and submit the thank you test form
    Then I should see the custom thank you message

  @finish-tab-preview
  Scenario: Preview tab shows the Thank You screen without submitting (#175)
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I click on the finish tab
    And I enable the custom thank you message
    And I set the custom thank you message to "Thank you for your feedback!"
    And I save the thank you settings
    Then the thank you settings should be saved successfully
    When I open the preview tab
    And I switch the preview step to "Finish"
    Then I should see the custom thank you message in the preview step
    When I switch the preview step to "Form"
    Then I should see the form in the preview step

  @finish-tab-substitution @skip-ci
  Scenario: Form shows field value substitution in thank you message configured from the Finish tab
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I click on the finish tab
    And I enable the custom thank you message
    And I add a field mention to the thank you message
    And I save the thank you settings
    Then the thank you settings should be saved successfully
    When I navigate from the builder to the form dashboard
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill the feedback field with "My amazing feedback"
    And I submit the thank you test form
    Then I should see the submitted value "My amazing feedback" in the thank you message
