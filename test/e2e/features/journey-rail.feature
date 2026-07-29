@journey-rail
Feature: Journey rail — Intro / Pages / Thank You selection (Content tab)

  The Content tab's leftmost column is the journey rail: Intro, Pages (with numbered
  field chips), and Thank You. Selecting any entry drives the canvas (FormRenderer
  screenOverride for intro/thankYou, FormArea for pages/fields) and the URL
  (?screen=…&field=…), and survives reload/back-forward. See epic #226, ticket #228.

  Background:
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields and L1 layout
    And I open the collaborative builder

  @journey-rail-intro
  Scenario: Selecting Intro in the rail shows the welcome screen and updates the URL
    When I click the rail Intro card
    Then the builder URL should contain "screen=intro"
    And the rail Intro card should be selected
    And I should see the intro screen in the canvas

  @journey-rail-page
  Scenario: Selecting a page in the rail shows its fields in the canvas and updates the URL
    When I click the rail page "About"
    Then the builder URL should contain "screen=page:cond-page-1"
    And I should see the field "Show bonus field?" in the canvas

  @journey-rail-field
  Scenario: Selecting a field chip in the rail opens its settings and updates the URL
    When I click the rail field chip "Bonus Field"
    Then the field settings panel should be visible
    And the builder URL should contain "screen=page:cond-page-1"
    And the builder URL should contain "field=cond-bonus"

  @journey-rail-thankyou
  Scenario: Selecting Thank You in the rail shows the thank-you screen and updates the URL
    When I click the rail Thank You card
    Then the builder URL should contain "screen=thankyou"
    And the rail Thank You card should be selected
    And I should see the thank you screen in the canvas

  @journey-rail-reload
  Scenario: Rail selection survives a reload via the URL
    When I click the rail Thank You card
    Then the builder URL should contain "screen=thankyou"
    When I reload the builder page
    Then the builder URL should contain "screen=thankyou"
    And the rail Thank You card should be selected
    And I should see the thank you screen in the canvas

  @journey-rail-reorder
  Scenario: Reordering pages via rail drag-and-drop
    Then the rail pages should be in order "About, Details, Contact"
    When I drag rail page "Contact" onto rail page "About"
    Then the rail pages should be in order "Contact, About, Details"

  @journey-rail-viewer
  Scenario: VIEWER sees a fully read-only rail
    When I open the collaborative builder with viewer permission
    Then I should not see the rail add content button
    And I should not see the rail add page button
    And I should not see any rail page drag handles

  # Contextual right panels (ticket #229): selecting Intro/Thank You/a page in
  # the rail now drives a real settings panel, not just the canvas — replacing
  # the old Design tab's LayoutSidebar for CTA text and background editing
  # (see thank-you-settings.feature's @skip-ci scenarios for the Layout tab
  # equivalents these retire).

  @journey-rail-intro-cta
  Scenario: Editing the Intro panel's button text updates the CTA text in the canvas
    When I click the rail Intro card
    Then the intro settings panel should be visible
    And the CTA button in the canvas should show "Get Started"
    When I set the intro button text to "Let's begin"
    Then the CTA button in the canvas should show "Let's begin"

  @journey-rail-ending-edit
  Scenario: Editing the Ending panel's message shows Save/Cancel and persists the change
    When I click the rail Thank You card
    Then the ending settings panel should be visible
    And I should not see the ending message save button
    When I edit the ending message to "Persisted ending copy"
    Then I should see the ending message save button
    When I save the ending message
    Then I should not see the ending message save button
    # The canvas's own inline thank-you editor has a known pre-existing render
    # lag right after a save unrelated to this change — assert post-reload
    # against the canvas instead of immediately after saving.
    When I reload the builder page
    Then the thank you screen should show the message "Persisted ending copy"

  @journey-rail-ending-cancel
  Scenario: Cancelling an Ending panel edit discards the change
    When I click the rail Thank You card
    Then the ending settings panel should be visible
    When I edit the ending message to "Discarded draft copy"
    Then I should see the ending message save button
    When I cancel the ending message edit
    Then I should not see the ending message save button
    When I reload the builder page
    Then the thank you screen should show the message "Thank you!"

  @journey-rail-page-pane
  Scenario: Selecting a page shows the Page pane with a working title input
    When I click the rail page "About"
    Then the page settings panel should be visible
    And the page settings title input should have value "About"
    When I set the page settings title to "About Renamed"
    Then the rail pages should be in order "About Renamed, Details, Contact"

  @journey-rail-panels-viewer
  Scenario: VIEWER sees read-only Intro, Ending, and Page panels
    When I open the collaborative builder with viewer permission
    And I click the rail Intro card
    Then the intro button text input should be disabled
    When I click the rail Thank You card
    Then I should not see the ending message save button
    When I click the rail page "About"
    Then the page settings title input should be disabled
    And I should not see the page settings duplicate button
    And I should not see the page settings delete button
