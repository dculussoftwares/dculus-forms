@FormCreation @Collaboration
Feature: Form Collaboration
  As a user
  I want to access the collaborative form builder after creating a form
  So that I can collaborate with others on form building and rearrange pages

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

  @PageRearrangement @Collaboration
  Scenario: Rearrange pages in collaborative form builder - basic functionality
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Multi-Page Event Form                    |
      | Description   | Testing page rearrangement functionality |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    And I should see 2 pages in the pages sidebar
    And I should see page 1 titled "Personal Information" in position 1
    And I should see page 2 titled "Event Details" in position 2

  @PageRearrangement @Collaboration @PageSwap
  Scenario: Swap page 2 to position 1
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Page Swap Test Form                      |
      | Description   | Testing swapping page 2 to position 1   |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I drag page 2 to position 1
    Then I should see the original page 2 now in position 1
    And I should see the original page 1 now in position 2
    And pages should be in order: "Event Details, Personal Information"

  @PageRearrangement @Collaboration @PageSwap
  Scenario: Swap page 1 to position 2
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Page Swap Test Form 2                    |
      | Description   | Testing swapping page 1 to position 2   |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I drag page 1 to position 2
    Then I should see the original page 1 now in position 2
    And I should see the original page 2 now in position 1
    And pages should be in order: "Event Details, Personal Information"

  @PageRearrangement @Collaboration @Verification
  Scenario: Verify page order persistence after rearrangement
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                         |
      | Form Title    | Page Order Persistence Test                   |
      | Description   | Testing page order persistence after changes |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I drag page 2 to position 1
    Then pages should be in order: "Event Details, Personal Information"
    When I refresh the page
    Then I should see the collaborative form builder interface
    And pages should be in order: "Event Details, Personal Information"
    And the page order should be persisted correctly