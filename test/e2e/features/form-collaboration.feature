@FormCreation @Collaboration
Feature: Form Collaboration
  As a user
  I want to access the collaborative form builder after creating a form
  So that I can collaborate with others on form building

  Background:
    Given I have test credentials ready
    And I am signed in as a new user

  @Creation @EventRegistration @Collaboration
  Scenario: Access collaborative form builder from Event Registration template
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Summer Conference 2025                   |
      | Description   | Registration for our annual conference   |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    And I should see the form builder interface
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    And I should see collaboration connection status