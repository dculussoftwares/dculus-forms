@thank-you
Feature: Thank You screen (Layout tab)

  Thank-you content lives on the form's layout (`FormLayout.thankYouContent`) and is
  edited live inside the builder's Layout tab via the intro/pages/thankYou screen
  toggle — there is no separate Finish tab or Settings section anymore (see epic
  #170). The message is always shown after submission (no enabled/disabled toggle),
  with a literal default until a form owner edits it.

  Background:
    Given I sign in with valid credentials

  @thank-you-default
  Scenario: Form shows the default thank you message after submission
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

  @thank-you-custom
  Scenario: Form shows a custom thank you message configured from the Layout tab
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I switch the layout canvas to the thank you screen
    And I edit the thank you message to "Thank you for your feedback!"
    Then the thank you screen should show the message "Thank you for your feedback!"
    When I navigate from the builder to the form dashboard
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    And I fill and submit the thank you test form
    Then I should see the thank you message "Thank you for your feedback!" in the form viewer

  @thank-you-persistence
  Scenario: Thank you message edits persist across a reload
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I switch the layout canvas to the thank you screen
    And I edit the thank you message to "Persisted thank you copy"
    Then the thank you screen should show the message "Persisted thank you copy"
    When I reload the builder page
    And I switch the layout canvas to the thank you screen
    Then the thank you screen should show the message "Persisted thank you copy"

  @thank-you-preview
  Scenario: Preview tab shows the Thank You screen without submitting (#175)
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I switch the layout canvas to the thank you screen
    And I edit the thank you message to "Thank you for your feedback!"
    Then the thank you screen should show the message "Thank you for your feedback!"
    When I open the preview tab
    And I switch the preview step to "Finish"
    Then I should see the thank you message "Thank you for your feedback!" in the preview step
    When I switch the preview step to "Form"
    Then I should see the form in the preview step

  @thank-you-substitution @skip-ci
  Scenario: Form shows field value substitution in the thank you message
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I switch the layout canvas to the thank you screen
    And I add a field mention to the thank you message
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
