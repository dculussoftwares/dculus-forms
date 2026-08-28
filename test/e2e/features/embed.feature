@embed
Feature: Form Embed v1 — a form filled in on someone else's page

  The point of these scenarios is the cross-origin boundary. The fixture host
  page is served from a different origin than the form-viewer, uses the exact
  snippet the Collect panel generates, and is driven as a visitor would drive
  it — so a broken postMessage contract, a collapsed layout, or an unattributed
  submission all fail here rather than in production.

  Background:
    Given I sign in with valid credentials

  @embed
  Scenario: Owner configures an inline embed and a visitor submits it from a third-party page
    When I create a form via GraphQL with all field types
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL

    # The panel is the only place the snippet comes from.
    When I open the collect responses panel on the embed tab
    Then the embed type "inline" should be selected
    And the embed snippet should contain "data-dculus-mode=\"inline\""
    And the embed snippet should contain the embed loader script
    When I copy the embed snippet
    Then the form's saved embed type should be "inline"

    # A genuinely different origin, running the snippet verbatim.
    When I open a host page with the copied inline embed snippet
    Then the embedded form should render inside the host page
    And the host page should have received a "dculus:ready" message
    And the embedded frame should be sized to its content

    When I submit the embedded form
    Then the host page should have received a "dculus:submit" message
    And no answer data should have crossed the frame boundary
    And the response should be recorded with embed context "inline"

  @embed
  Scenario: A form that requires sign-in cannot be embedded
    When I create a form via GraphQL with all field types
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I require respondents to sign in
    And I open the collect responses panel on the embed tab
    Then the framed embed types should be disabled
    And the gated embed warning should be shown
    And the embed type "button" should be selected

  @embed
  Scenario: A lightbox embed opens, traps focus, and closes on Escape
    When I create a form via GraphQL with all field types
    Then I should be on the new form dashboard
    When I publish the form
    Then the form should be published
    When I get the form short URL

    When I open a host page with a lightbox embed snippet
    Then the lightbox trigger button should be visible
    And no embedded frame should have loaded yet

    When I click the lightbox trigger
    Then the lightbox overlay should be open
    And the host page body scroll should be locked

    When I press Escape inside the embedded form
    Then the lightbox overlay should be closed
    And the host page body scroll should be restored
    And focus should return to the lightbox trigger
