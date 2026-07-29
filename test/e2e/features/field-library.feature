@field-library
Feature: Field Library — mega-panel + pin-to-dock (Content tab)

  The rail's "+ Add content" button opens the Field Library mega-panel: a searchable
  3-column grid of every field type, grouped Input/Choice/Content/Advanced, with a
  Recently used row. Pinning docks it as a persistent compact column between the rail
  and the canvas, replacing the old always-visible field-types column. See epic #226,
  ticket #230.

  Background:
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields and L1 layout
    And I open the collaborative builder
    And I click the rail page "About"

  @field-library-megapanel
  Scenario: Opening the library shows every field type at once
    When I open the field library
    Then I should see the field type "Short Text" in the library
    And I should see the field type "Email" in the library
    And I should see the field type "File Upload" in the library

  @field-library-search
  Scenario: Searching filters the tiles to matching field types
    When I open the field library
    And I search the field library for "ema"
    Then I should see the field type "Email" in the library
    And I should not see the field type "Short Text" in the library

  @field-library-click-add
  Scenario: Clicking a tile appends the field to the selected page
    When I open the field library
    And I click the field type "Short Text" in the library
    Then I should see the field "Short Text" in the canvas

  @field-library-enter
  Scenario: Enter adds the first search match
    When I open the field library
    And I search the field library for "ema"
    And I press Enter in the field library search
    Then I should see the field "Email" in the canvas

  @field-library-pin
  Scenario: Pinning docks the library; it survives a reload
    When I open the field library
    And I pin the field library
    Then the field library should be docked
    When I reload the builder page
    And I click the rail page "About"
    Then the field library should be docked
    When I unpin the field library
    Then the field library should not be docked

  @field-library-viewer
  Scenario: VIEWER has no add-content entry point and "/" is inert
    When I open the collaborative builder with viewer permission
    Then I should not see the rail add content button
    When I press "/" in the builder
    Then I should not see the field library search input
