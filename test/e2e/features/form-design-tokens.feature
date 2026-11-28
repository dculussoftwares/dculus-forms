@design-tokens
Feature: Per-form design tokens (brand color & style)

  The Design drawer's "Brand & style" controls write `layout.tokens` through the
  collaborative (Y.js / Hocuspocus) document. Published forms render with a
  `data-df-branded` wrapper, an inline `--df-primary` CSS var and a submit/next
  button using `background-color: var(--df-primary)`. "Reset brand style" removes
  the `tokens` key so the form returns to its legacy (unbranded) look.
  See docs/design-tokens-plan.md. Requires the `en` locale.

  Background:
    Given I sign in with valid credentials
    When I create a form via GraphQL for design tokens testing
    And I open the collaborative builder
    And I click the rail Intro card

  @design-tokens-viewer
  Scenario: Brand color and solid button style are applied to the published form
    When I click the canvas toolbar Design button
    And I pick the brand color swatch "#2563eb" in the design drawer
    And I set the brand style "Button style" to "Solid" in the design drawer
    And I close the design drawer
    # Reload to make sure the tokens reached the persisted Hocuspocus document
    # before the dashboard publishes the form.
    And I reload the builder page
    And I navigate from the builder to the form dashboard
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    Then the viewer form should be branded with "#2563eb"
    And the viewer submit button background color should be "rgb(37, 99, 235)"

  @design-tokens-persistence
  Scenario: Design drawer controls retain their values after reloading the builder
    When I click the canvas toolbar Design button
    And I pick the brand color swatch "#2563eb" in the design drawer
    And I set the brand style "Button style" to "Solid" in the design drawer
    And I set the brand style "Corners" to "Large" in the design drawer
    And I set the brand style "Input style" to "Underline" in the design drawer
    And I close the design drawer
    And I reload the builder page
    And I click the canvas toolbar Design button
    Then the design drawer should be visible
    And the design drawer brand color should be "#2563eb"
    And the design drawer brand style "Button style" should be "Solid"
    And the design drawer brand style "Corners" should be "Large"
    And the design drawer brand style "Input style" should be "Underline"

  @design-tokens-reset
  Scenario: Reset brand style removes branding from the published form
    When I click the canvas toolbar Design button
    And I pick the brand color swatch "#2563eb" in the design drawer
    And I set the brand style "Button style" to "Solid" in the design drawer
    And I reset the brand style in the design drawer
    Then the design drawer brand color should be empty
    When I close the design drawer
    And I reload the builder page
    And I click the canvas toolbar Design button
    Then the design drawer brand color should be empty
    When I close the design drawer
    And I navigate from the builder to the form dashboard
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I click the CTA button to start the form
    Then the viewer form should not be branded
