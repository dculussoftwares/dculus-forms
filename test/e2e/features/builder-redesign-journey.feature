@builder-redesign-journey
Feature: Builder redesign — end-to-end journey

  One scenario touching every surface the epic (#226) redesigned in a single pass:
  the journey rail's Intro card, the Field Library, the Logic tab, the Preview
  overlay, and publishing. Each individual surface has its own dedicated feature
  file (journey-rail.feature, field-library.feature, conditional-logic.feature,
  builder-shell.feature) — this scenario exists to catch integration regressions
  between them that per-surface coverage wouldn't. See ticket #234.

  @builder-redesign-journey-happy-path
  Scenario: Create a form, edit its intro, add a field, add a condition, preview, and publish
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields and L1 layout
    And I open the collaborative builder

    # Rail: edit the intro CTA
    When I click the rail Intro card
    Then the intro settings panel should be visible
    When I set the intro button text to "Let's begin"
    Then the CTA button in the canvas should show "Let's begin"

    # Field Library: add a field to a page
    When I click the rail page "About"
    And I open the field library
    And I click the field type "Short Text" in the library
    Then I should see the field "Short Text" in the canvas

    # Logic: add a condition rule
    When I open the conditions tab
    And I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then I should see a condition rule card for "Show bonus field?"

    # Preview overlay
    When I open the preview tab
    Then the preview overlay should be open
    When I press Escape
    Then the preview overlay should be closed

    # Publish
    When I navigate from the builder to the form dashboard
    And I publish the form
    Then the form should be published
