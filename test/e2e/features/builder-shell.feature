@builder-shell
Feature: Builder shell — 3-tab navigation, redirects, Preview/Settings overlays

  The builder collapses from 5 tabs to 3 (Content · Logic · Automations). Preview and
  Settings are no longer tabs — they move into a full-screen overlay (▶ Preview button
  in the Content tab's canvas toolbar as of ticket #231, plus Cmd/Ctrl+P, ?preview=1)
  and a header ⚙ gear dialog (?settings=1) respectively, hosting the existing
  PreviewTab/SettingsTab unchanged. The 5 old tab URLs redirect to the new shell.
  See epic #226, tickets #227 and #231.

  Background:
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields
    And I open the collaborative builder

  @builder-shell-tabs
  Scenario: Builder renders the 3-tab shell
    Then I should see the "content" tab active
    And I should see the "logic" tab
    And I should see the "automations" tab
    And I should not see a "layout" tab
    And I should not see a "conditions" tab
    And I should not see a "preview" tab
    And I should not see a "settings" tab

  @builder-shell-redirects
  Scenario Outline: Old builder tab URLs redirect to the new shell
    When I navigate directly to the old builder URL "<oldPath>"
    Then the builder URL should become "<newPath>"

    Examples:
      | oldPath      | newPath               |
      | layout       | content?screen=intro  |
      | page-builder | content               |
      | conditions   | logic                 |
      | preview      | content?preview=1     |
      | settings     | content?settings=1    |

  @builder-shell-preview
  Scenario: Preview overlay opens via the canvas toolbar button and closes with Esc
    When I click the canvas toolbar Preview button
    Then the preview overlay should be open
    When I press Escape
    Then the preview overlay should be closed
    And I should see the "content" tab active

  @builder-shell-settings
  Scenario: Settings gear opens the settings overlay; hidden for VIEWER
    When I click the header settings gear
    Then the settings overlay should be open
    When I press Escape
    Then the settings overlay should be closed
    When I open the collaborative builder with viewer permission
    Then I should not see the header settings gear
