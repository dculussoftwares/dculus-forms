Feature: Conditional Logic - skipToPage action (v1.5)

  Scenario: skipToPage skips intermediate pages, updates page count, and strips intermediate values on submit
    Given I sign in with valid credentials
    When I create a 4-page form via GraphQL with a skipToPage condition rule
    And I publish the form
    Then the form should be published
    When I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should be on viewer page 1 of 4

    # Fill Page 2 and Page 3 while skip is not active
    When I click next in the viewer
    Then I should be on viewer page 2 of 4
    When I fill the viewer input "skip-p2-text" with "p2 secret"
    And I click next in the viewer
    Then I should be on viewer page 3 of 4
    When I fill the viewer input "skip-p3-text" with "p3 secret"

    # Navigate back to Page 1 and activate skipToPage (Page 4)
    And I click previous in the viewer
    And I click previous in the viewer
    Then I should be on viewer page 1 of 4
    When I choose viewer radio option "Yes" for "Skip to Page 4?"
    Then I should be on viewer page 1 of 2

    # Next from Page 1 lands directly on Page 4
    When I click next in the viewer
    Then I should be on viewer page 2 of 2
    And the viewer field "Page 4 Field" should be visible
    When I fill the viewer input "skip-p4-text" with "p4 final"

    # Prev from Page 4 returns to Page 1
    When I click previous in the viewer
    Then I should be on viewer page 1 of 2

    # Return to Page 4 and submit
    When I click next in the viewer
    And I submit the conditional logic form in the viewer

    # Assert responses on skipped pages were stripped at submit
    Then the stored response should include values for "skip-trigger-radio, skip-p4-text"
    And the stored response should not include values for "skip-p2-text, skip-p3-text"
