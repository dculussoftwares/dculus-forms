@thank-you
Feature: Thank You screen (Ending panel)

  Thank-you content lives on the form's layout (`FormLayout.thankYouContent`). It used
  to be edited live inside the builder's Layout tab via the intro/pages/thankYou screen
  toggle (see epic #170); as of ticket #229 that editing surface is the journey rail's
  Thank You card + Ending panel instead (see journey-rail.feature's ending-edit and
  ending-cancel scenarios for the core edit/persist/cancel coverage). The message is
  always shown after submission (no enabled/disabled toggle), with a literal default
  until a form owner edits it.

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

  # Editing surface is the journey rail's Thank You card + Ending panel (ticket #229) —
  # journey-rail.feature's @journey-rail-ending-edit/@journey-rail-ending-cancel cover
  # the core edit/Save/Cancel/persist-through-reload behavior against that panel. The
  # three scenarios below round out coverage this ticket (#234) needs beyond that:
  # custom-message-through-to-public-viewer, the preview overlay, and field-mention
  # substitution — all re-driven through the Ending panel instead of the removed
  # Layout tab.
  @thank-you-custom
  Scenario: Form shows a custom thank you message configured from the Ending panel
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I click the rail Thank You card
    And I edit the ending message to "Thank you for your feedback!"
    And I save the ending message
    # The canvas's own inline thank-you editor has a known pre-existing render lag
    # right after a save (see journey-rail.feature's @journey-rail-ending-edit) —
    # assert post-reload against the canvas instead of immediately after saving.
    When I reload the builder page
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

  @thank-you-preview
  Scenario: Preview overlay shows the Thank You screen without submitting (#175)
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I click the rail Thank You card
    And I edit the ending message to "Thank you for your feedback!"
    And I save the ending message
    And I open the preview tab
    And I switch the preview step to "Finish"
    Then I should see the thank you message "Thank you for your feedback!" in the preview step
    When I switch the preview step to "Form"
    Then I should see the form in the preview step

  @thank-you-substitution
  Scenario: Form shows field value substitution in the thank you message
    When I create a form via GraphQL for thank you page testing
    Then I should be on the new form dashboard
    When I navigate to the form builder
    And I click the rail Thank You card
    And I add a field mention to the ending message
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
