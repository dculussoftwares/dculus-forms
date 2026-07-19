Feature: Conditional Logic (show/hide fields and pages)

  # Viewer behavior for a form whose schema carries conditional rules:
  # - a showField target starts hidden and appears when its rule matches
  # - a hidePage rule removes the page from the flow (progress + navigation)
  # - values typed into fields hidden at submit time are stripped from the
  #   stored response ("keep while filling, strip at submit")
  Scenario: Field and page rules drive the viewer and hidden values are stripped at submit
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic rules
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should be on viewer page 1 of 3
    And the viewer field "Bonus Field" should be hidden

    # showField rule: selecting Yes reveals the default-hidden bonus field
    When I choose viewer radio option "Yes" for "Show bonus field?"
    Then the viewer field "Bonus Field" should be visible
    When I fill the viewer input "cond-bonus" with "bonus answer"

    # hidePage rule: page count updates live
    When I choose viewer radio option "Yes" for "Skip details page?"
    Then I should be on viewer page 1 of 2
    When I choose viewer radio option "No" for "Skip details page?"
    Then I should be on viewer page 1 of 3

    # fill the details page, then hide it again — its value must not survive submit
    When I click next in the viewer
    Then the viewer field "Details Text" should be visible
    When I fill the viewer input "cond-details" with "this value must be stripped"
    And I click previous in the viewer
    And I choose viewer radio option "Yes" for "Skip details page?"
    And I click next in the viewer
    Then the viewer field "Contact Note" should be visible
    When I fill the viewer input "cond-contact" with "contact answer kept"
    And I submit the conditional logic form in the viewer
    Then the stored response should include values for "cond-show-bonus, cond-skip-details, cond-bonus, cond-contact"
    And the stored response should not include values for "cond-details"

  # Builder UI: authoring a rule through the Conditions tab
  @builder-ux
  Scenario: Create a condition rule through the builder Conditions tab
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields
    And I open the collaborative builder
    And I open the conditions tab
    Then I should see the conditions empty state
    When I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then I should see a condition rule card for "Show bonus field?"

  @builder-ux
  Scenario: Rule lifecycle
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields
    And I open the collaborative builder
    And I open the conditions tab
    Then I should see the conditions empty state
    When I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then I should see a condition rule card for "Show bonus field?"
    And the condition card for "Show bonus field?" should show "IF Show bonus field? is equal to “Yes” THEN Show field(s) Bonus Field" in its summary
    When I edit the condition rule for "Show bonus field?"
    And I update the rule terms at index 0 to field "Skip details page?", operator "notEquals", value "No"
    And I update the rule action at index 0 to type "hideField" and target field "cond-bonus"
    And I save the condition rule
    Then the condition card for "Skip details page?" should show "IF Skip details page? is not equal to “No” THEN Hide field(s) Bonus Field" in its summary
    When I toggle the condition rule for "Skip details page?"
    And I open the preview tab
    Then the preview field "Bonus Field" should be visible
    When I open the conditions tab
    And I toggle the condition rule for "Skip details page?"
    And I open the preview tab
    Then the preview field "Bonus Field" should be hidden
    When I choose preview radio option "No" for "Skip details page?"
    Then the preview field "Bonus Field" should be visible
    When I open the conditions tab
    And I delete the condition rule for "Skip details page?"
    Then I should see the conditions empty state

  @builder-ux
  Scenario: Broken-reference badge (field)
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields
    And I open the collaborative builder
    And I open the conditions tab
    When I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    And I open the page builder tab
    And I delete the field "cond-show-bonus" in the builder
    And I open the conditions tab
    Then I should see a broken reference badge for the rule "Show bonus field?"

  @builder-ux
  Scenario: Broken-reference badge (option rename)
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields
    And I open the collaborative builder
    And I open the conditions tab
    When I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    And I open the page builder tab
    And I open the field settings for "cond-show-bonus"
    And I rename option "Yes" to "Oui"
    And I save the builder field settings
    And I open the conditions tab
    Then I should see a broken reference badge for the rule "Show bonus field?"

  @builder-ux
  Scenario: VIEWER permission read-only
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic rules
    And I open the collaborative builder with viewer permission
    And I open the conditions tab
    Then I should see a read-only conditions tab

  @builder-ux
  Scenario: Tamil locale
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields
    And I open the collaborative builder
    When I switch locale to "ta" via the locale switcher
    And I open the conditions tab
    Then I should see the conditions tab header in Tamil

  @builder-ux
  Scenario: Preview parity
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic rules
    And I open the collaborative builder
    And I open the preview tab
    Then the preview field "Bonus Field" should be hidden
    When I choose preview radio option "Yes" for "Show bonus field?"
    Then the preview field "Bonus Field" should be visible

  @builder-ux
  Scenario: Circular-reference warning badge
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields
    And I open the collaborative builder
    And I open the conditions tab
    When I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then I should see a condition rule card for "Show bonus field?"
    And I should not see a circular reference warning badge for the rule "Show bonus field?"
    When I add a self-hiding rule for field "cond-bonus" when filled
    Then I should see a circular reference warning badge for the rule "Bonus Field"


