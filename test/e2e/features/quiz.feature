@quiz
Feature: Native Quiz

  Background:
    Given I sign in with valid credentials

  Scenario: Create a quiz via the wizard, author answer keys, publish, and see the graded score as a respondent
    When I create a quiz via the wizard titled "Trivia Night"
    Then I should be in the collaborative builder
    When I drag a radio field onto the page
    And I open the radio field settings
    And I mark the first option as the correct answer
    And I save the radio field settings
    Then quiz mode should be visible in the builder
    When I drag a checkbox field onto the page
    And I open the checkbox field settings
    And I mark the first option as the correct answer
    And I save the checkbox field settings
    When I navigate to the form dashboard from the builder
    And I publish the form
    And I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I dismiss the viewer cover screen if present
    And I answer the radio and checkbox questions correctly in the viewer
    And I should be able to submit the form in viewer
    Then I should see a passing quiz score on the result screen

  Scenario: Quiz score is visible in the responses table and can be sorted
    When I create a quiz form via GraphQL with gradeRelease "immediate"
    And I publish the quiz form
    And I get the form short URL
    And I submit a fully correct quiz response as a respondent
    And I submit a fully incorrect quiz response as a respondent
    When I view the responses table for the quiz form
    Then I should see 2 responses in the table
    And I should see a Score column in the responses table
    Then clicking the score column header should sort the responses by score

  Scenario: gradeRelease afterReview withholds the score from the respondent
    When I create a quiz form via GraphQL with gradeRelease "afterReview"
    And I publish the quiz form
    And I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I answer the radio and checkbox questions correctly in the viewer
    And I should be able to submit the form in viewer
    Then I should see the quiz pending message in the viewer
    And I should not see a quiz score or badge in the viewer

  Scenario: An existing non-quiz form is completely unaffected by Native Quiz
    When I create a non-quiz form via GraphQL for the regression check
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I drag a short text field onto the page
    Then the quiz summary strip should not be visible in the builder
    When I open the short text field settings
    Then the grading settings section should not be visible
    When I fill the short text field settings with valid data
    And I save the field settings
    And I navigate back to the form dashboard
    And I publish the form
    And I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I dismiss the viewer cover screen if present
    And I fill the only text field with valid data in the viewer
    And I should be able to submit the form in viewer
    Then the viewer should show the thank you screen
    And no quiz result UI should be shown in the viewer
    When I view the responses table for the quiz form
    Then there should be no quiz score column in the responses table
