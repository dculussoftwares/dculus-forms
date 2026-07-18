Feature: Conditional Logic Downstream Surfaces

  # Coordinated checks for downstream surfaces when fields or pages are conditionally hidden
  # (and stripped from submission payloads).
  # We reuse the same form creation and viewer logic, then verify:
  # 1. Responses table displays cells correctly (stripped fields render as blank/empty label)
  # 2. Individual response detail panel opens without errors and displays empty cells correctly
  # 3. Excel/CSV export shows empty cells for hidden columns (using exceljs to parse the download)
  # 4. Field analytics page displays reduced response counts for the conditionally hidden fields

  Background:
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic rules
    And I publish the form
    And I get the form short URL

    # Response 1: Everything visible
    When I navigate to the form viewer with the short URL
    Then I should be on viewer page 1 of 3
    When I choose viewer radio option "Yes" for "Show bonus field?"
    And I fill the viewer input "cond-bonus" with "bonus visible"
    And I choose viewer radio option "No" for "Skip details page?"
    And I click next in the viewer
    Then the viewer field "Details Text" should be visible
    When I fill the viewer input "cond-details" with "details visible"
    And I click next in the viewer
    Then the viewer field "Contact Note" should be visible
    When I fill the viewer input "cond-contact" with "contact visible"
    And I submit the conditional logic form in the viewer

    # Response 2: Field hidden
    When I navigate to the form viewer with the short URL again
    Then I should be on viewer page 1 of 3
    When I choose viewer radio option "No" for "Show bonus field?"
    And I choose viewer radio option "No" for "Skip details page?"
    And I click next in the viewer
    Then the viewer field "Details Text" should be visible
    When I fill the viewer input "cond-details" with "details field hidden"
    And I click next in the viewer
    Then the viewer field "Contact Note" should be visible
    When I fill the viewer input "cond-contact" with "contact field hidden"
    And I submit the conditional logic form in the viewer

    # Response 3: Page hidden
    When I navigate to the form viewer with the short URL again
    Then I should be on viewer page 1 of 3
    When I choose viewer radio option "Yes" for "Show bonus field?"
    And I fill the viewer input "cond-bonus" with "bonus page hidden"
    And I choose viewer radio option "Yes" for "Skip details page?"
    And I click next in the viewer
    Then the viewer field "Contact Note" should be visible
    When I fill the viewer input "cond-contact" with "contact page hidden"
    And I submit the conditional logic form in the viewer

  Scenario: Downstream surfaces handle stripped responses cleanly
    # Scenario 1 & 2: Responses table and Individual response view
    When I navigate to the downstream form responses page
    Then I should see the responses table with 3 responses and correct stripped cells
    And I open the detail panel for each response and verify no crashes

    # Scenario 3: Excel export download and parse check
    And I export responses as Excel and parse the file

    # Scenario 4: Field analytics counts check
    When I navigate to the form analytics page
    Then I open the fields tab in analytics
    And the analytics for "Bonus Field" should show 2 responses
    And the analytics for "Details Text" should show 2 responses
