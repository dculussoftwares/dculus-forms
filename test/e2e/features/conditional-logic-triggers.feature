@conditional-logic @conditional-logic-matrix
Feature: Conditional logic trigger matrix (every field type x operators in the viewer)

  Background:
    Given I sign in with valid credentials
    When I create a form via GraphQL with the conditional logic trigger matrix
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL

  Scenario: 1. Text equals (trim and case-insensitive)
    Then the viewer field "Probe Text Equals" should be visible
    When I fill the viewer input "trig-text" with "  HELLO  "
    Then the viewer field "Probe Text Equals" should be hidden
    When I clear the viewer input "trig-text"
    Then the viewer field "Probe Text Equals" should be visible

  Scenario: 2. Text contains, startsWith, endsWith
    Then the viewer field "Probe Text Contains" should be visible
    And the viewer field "Probe Text Starts" should be visible
    And the viewer field "Probe Text Ends" should be visible
    When I fill the viewer input "trig-text" with "startmidend"
    Then the viewer field "Probe Text Contains" should be hidden
    And the viewer field "Probe Text Starts" should be hidden
    And the viewer field "Probe Text Ends" should be hidden
    When I clear the viewer input "trig-text"
    Then the viewer field "Probe Text Contains" should be visible
    And the viewer field "Probe Text Starts" should be visible
    And the viewer field "Probe Text Ends" should be visible

  Scenario: 3. Text isEmpty
    # On load, trig-text is empty, so probe-text-empty rule matches (isEmpty) -> hides the probe.
    Then the viewer field "Probe Text Empty" should be hidden
    When I fill the viewer input "trig-text" with "not empty"
    Then the viewer field "Probe Text Empty" should be visible
    When I clear the viewer input "trig-text"
    Then the viewer field "Probe Text Empty" should be hidden

  Scenario: 4. Email endsWith
    Then the viewer field "Probe Email Ends" should be visible
    When I fill the viewer input "trig-email" with "jane@ACME.com"
    Then the viewer field "Probe Email Ends" should be hidden
    When I clear the viewer input "trig-email"
    Then the viewer field "Probe Email Ends" should be visible

  Scenario: 5. Phone startsWith
    # Phone field defaults to IN (+91), so typing a 10-digit valid Indian number makes it complete & valid.
    Then the viewer field "Probe Phone Starts" should be visible
    When I fill the viewer input "trig-phone" with "9876543210"
    Then the viewer field "Probe Phone Starts" should be hidden
    When I fill the viewer input "trig-phone" with ""
    Then the viewer field "Probe Phone Starts" should be visible

  Scenario: 6. Number greaterThan and equals 0
    Then the viewer field "Probe Number GT" should be visible
    And the viewer field "Probe Number Zero" should be visible
    # greaterThan 10
    When I fill the viewer input "trig-number" with "11"
    Then the viewer field "Probe Number GT" should be hidden
    When I fill the viewer input "trig-number" with "10"
    Then the viewer field "Probe Number GT" should be visible
    # equals 0
    When I fill the viewer input "trig-number" with "0"
    Then the viewer field "Probe Number Zero" should be hidden
    When I clear the viewer input "trig-number"
    Then the viewer field "Probe Number Zero" should be visible

  Scenario: 7. Date before 2026-01-01
    Then the viewer field "Probe Date Before" should be visible
    When I set the viewer date input "trig-date" to "2025-12-31"
    Then the viewer field "Probe Date Before" should be hidden
    When I set the viewer date input "trig-date" to "2026-01-02"
    Then the viewer field "Probe Date Before" should be visible

  Scenario: 8. Select equals and Checkbox contains/notContains
    Then the viewer field "Probe Select Equals" should be visible
    And the viewer field "Probe Checkbox Contains" should be visible
    # checkbox notContains Option B matches initially because array is empty -> hides probe
    And the viewer field "Probe Checkbox Not Contains" should be hidden

    # Select equals
    When I choose viewer dropdown option "Option 1" for "Select Trigger"
    Then the viewer field "Probe Select Equals" should be hidden

    # Checkbox contains
    When I choose viewer checkbox option "Option A" for "Checkbox Trigger"
    Then the viewer field "Probe Checkbox Contains" should be hidden

    # Checkbox notContains no longer matches once Option B is checked
    When I choose viewer checkbox option "Option B" for "Checkbox Trigger"
    Then the viewer field "Probe Checkbox Not Contains" should be visible

  Scenario: 9. FileUpload isFilled
    Then the viewer field "Probe File Filled" should be visible
    When I attach a text file to the "trig-file" upload field in the viewer
    Then the viewer field "Probe File Filled" should be hidden
    When I remove the attached file "stripped-file.txt" in the viewer
    Then the viewer field "Probe File Filled" should be visible

  Scenario: 10. Multi-term rules (all vs any combinators)
    Then the viewer field "Probe Multi All" should be visible
    And the viewer field "Probe Multi Any" should be visible

    # Match only trig-text: 'any' matches (hides probe), 'all' does not
    When I fill the viewer input "trig-text" with "hello"
    Then the viewer field "Probe Multi Any" should be hidden
    And the viewer field "Probe Multi All" should be visible

    # Match both trig-text and trig-number: both rules match (hides both probes)
    When I fill the viewer input "trig-number" with "15"
    Then the viewer field "Probe Multi Any" should be hidden
    And the viewer field "Probe Multi All" should be hidden

    # Match only trig-number: 'any' matches (hides probe), 'all' does not
    When I clear the viewer input "trig-text"
    Then the viewer field "Probe Multi Any" should be hidden
    And the viewer field "Probe Multi All" should be visible
