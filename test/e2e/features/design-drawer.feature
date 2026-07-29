@design-drawer
Feature: Design drawer — global layout, theme, spacing, background (Content tab)

  The 🎨 Design button in the Content tab's canvas toolbar opens a drawer over the
  right panel with the *global* look controls that used to live in the Design tab's
  LayoutSidebar: layout family (L1-L9), theme, spacing, page mode, and background
  (color + image/video + Pexels + Pixabay + clear). The Design tab itself is retired
  — LayoutTab and LayoutSidebar are deleted. See epic #226, ticket #231.

  Background:
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields and L1 layout
    And I open the collaborative builder
    And I click the rail Intro card

  @design-drawer-open
  Scenario: Opening the Design drawer shows the global layout controls
    When I click the canvas toolbar Design button
    Then the design drawer should be visible
    And the design drawer should show layout thumbnails for all 9 layouts

  @design-drawer-layout-switch
  Scenario: Switching the layout code in the Design drawer re-renders the canvas
    Then the CTA button in the canvas should show "Get Started"
    When I click the canvas toolbar Design button
    And I select layout "L9" in the design drawer
    Then the design drawer layout "L9" should be selected
    When I close the design drawer
    Then I should not see a CTA button in the canvas
    When I click the canvas toolbar Design button
    And I select layout "L1" in the design drawer
    Then the design drawer layout "L1" should be selected
    When I close the design drawer
    Then the CTA button in the canvas should show "Get Started"

  @design-drawer-viewer
  Scenario: VIEWER sees the Design button but every drawer control is disabled
    When I open the collaborative builder with viewer permission
    And I click the rail Intro card
    And I click the canvas toolbar Design button
    Then the design drawer should be visible
    And the design drawer layout thumbnails should be disabled
