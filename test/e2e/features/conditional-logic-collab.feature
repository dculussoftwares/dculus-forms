@skip-ci @builder-ux @collaboration
Feature: Real-time Collaboration for Condition Rules

  Background:
    Given I sign in with valid credentials
    And I save my session
    When I create a form via GraphQL with conditional logic fields
    And I open two collaborative builder sessions on the conditions tab

  Scenario: Create syncs
    When In session "A" I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then In session "B" I should see a condition rule card for "Show bonus field?"
    And In session "B" the condition card for "Show bonus field?" should show "IF Show bonus field? is equal to “Yes” THEN Show field(s) Bonus Field" in its summary

  Scenario: Toggle and delete syncs
    When In session "A" I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then In session "B" I should see a condition rule card for "Show bonus field?"
    When In session "A" I toggle the condition rule for "Show bonus field?"
    Then In session "B" the condition rule switch state should update to disabled
    When In session "B" I delete the condition rule for "Show bonus field?"
    Then In session "A" I should see the conditions empty state

  Scenario: Concurrent edits to different rules survive
    When In session "A" I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    And In session "A" I add a rule hiding page "Page 2 — Details" when "Skip details page?" is equal to "Yes"
    Then In session "B" I should see a condition rule card for "Show bonus field?"
    And In session "B" I should see a condition rule card for "Skip details page?"
    When In session "A" I edit the condition rule for "Show bonus field?"
    And In session "B" I edit the condition rule for "Skip details page?"
    And In session "A" I update the rule terms at index 0 to field "Show bonus field?", operator "equals", value "No"
    And In session "B" I update the rule action at index 0 to type "hideField" and target field "cond-bonus"
    And In session "A" I save the condition rule
    And In session "B" I save the condition rule
    Then In session "B" the condition card for "Show bonus field?" should show "IF Show bonus field? is equal to “No” THEN Show field(s) Bonus Field" in its summary
    And In session "A" the condition card for "Skip details page?" should show "IF Skip details page? is equal to “Yes” THEN Hide field(s) Bonus Field" in its summary

  Scenario: Same-rule concurrent edits resolve last-writer-wins
    When In session "A" I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then In session "B" I should see a condition rule card for "Show bonus field?"
    When In session "A" I edit the condition rule for "Show bonus field?"
    And In session "B" I edit the condition rule for "Show bonus field?"
    And In session "A" I update the rule terms at index 0 to field "Show bonus field?", operator "equals", value "No"
    And In session "B" I update the rule terms at index 0 to field "Show bonus field?", operator "notEquals", value "Yes"
    And In session "A" I save the condition rule
    And In session "B" I save the condition rule
    Then In both sessions there should be exactly one condition rule card for "Show bonus field?"
    And In both sessions that rule card's summary should equal one of the two writes

  Scenario: Cross-session broken reference
    When In session "A" I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then In session "B" I should see a condition rule card for "Show bonus field?"
    When In session "A" I open the page builder tab
    And In session "A" I delete the field "cond-show-bonus" in the builder
    Then In session "B" I should see a broken reference badge for the rule "Show bonus field?"
