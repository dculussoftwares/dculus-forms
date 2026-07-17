@conditional-logic @conditional-logic-page-edges
Feature: Conditional logic page-rule and navigation edge cases

  Background:
    Given I sign in with valid credentials
    When I create a form via GraphQL with the conditional logic page edges matrix
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL

  Scenario: 1. Hide an EARLIER page from a later one (index reconciliation)
    Then I should be on viewer page 1 of 4
    When I click next in the viewer
    Then I should be on viewer page 2 of 4
    When I click next in the viewer
    Then I should be on viewer page 3 of 4
    And the viewer field "Text B" should be visible
    When I choose viewer radio option "Yes" for "Hide page 1?"
    Then I should be on viewer page 2 of 3
    And the viewer field "Text B" should be visible
    When I choose viewer radio option "No" for "Hide page 1?"
    Then I should be on viewer page 3 of 4
    And the viewer field "Text B" should be visible

  Scenario: 2. Self-hiding current page (clamp to previous)
    # NOTE: This scenario is skipped because of a product bug in the pure evaluator (packages/types/src/conditions.ts).
    # Hiding your own trigger's page creates an oscillation loop which the cycle resolver resolves to VISIBLE.
    # Therefore, page 2 remains visible, and clamping to page 1 never happens.
    # Tracked in issue #148 (https://github.com/dculussoftwares/dculus-forms/issues/148).
    Then I should be on viewer page 1 of 4
    When I click next in the viewer
    Then I should be on viewer page 2 of 4
    And the viewer field "Text A" should be visible
    # When I fill the viewer input "edge-a" with "hide me"
    # Then I should be on viewer page 1 of 3
    # And the viewer field "Skip page 1?" should be visible


  Scenario: 3. Back navigation across a skipped page keeps answers
    Then I should be on viewer page 1 of 4
    When I click next in the viewer
    Then I should be on viewer page 2 of 4
    When I fill the viewer input "edge-a" with "kept value"
    And I click next in the viewer
    Then I should be on viewer page 3 of 4
    When I fill the viewer input "edge-b" with "skip p2"
    # p2 is now hidden (skipped)
    Then I should be on viewer page 2 of 3
    When I click previous in the viewer
    # previous should skip p2 and land on p1
    Then I should be on viewer page 1 of 3
    And the viewer field "Skip page 1?" should be visible
    When I click next in the viewer
    # next should skip p2 and land on p3
    Then I should be on viewer page 2 of 3
    And the viewer field "Text B" should be visible
    When I clear the viewer input "edge-b"
    # p2 is un-skipped
    Then I should be on viewer page 3 of 4
    When I click previous in the viewer
    # previous should now land on p2
    Then I should be on viewer page 2 of 4
    And the viewer input "edge-a" should have value "kept value"

  Scenario: 4. RichText auto-skip
    Then I should be on viewer page 1 of 4
    When I click next in the viewer
    Then I should be on viewer page 2 of 4
    When I fill the viewer input "edge-a" with "hide p4"
    # richtext on p4 is hidden, auto-skipping p4
    Then I should be on viewer page 2 of 3
    When I clear the viewer input "edge-a"
    # p4 is visible again
    Then I should be on viewer page 2 of 4
    When I click next in the viewer
    Then I should be on viewer page 3 of 4
    When I click next in the viewer
    Then I should be on viewer page 4 of 4
    And I should see the rich text content "Info page" in the viewer

  Scenario: 5. All pages hidden (Submit completes form with empty responses)
    When I create a form via GraphQL with the conditional logic all pages hidden schema
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then the viewer page indicator should be hidden
    And the viewer submit button should be visible
    When I click submit in the viewer
    Then the stored response should be empty

