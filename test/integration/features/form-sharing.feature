@GraphQL @FormSharing @Critical
Feature: Form Sharing and Permissions
  As a form owner
  I want to share forms with organization members
  So that collaborators can view or edit my forms with appropriate access levels

  Background:
    Given the database is clean
    And an organization owner "owner@test.com" exists with password "StrongPass123!" and organization "Test Org"
    And another user "editor@test.com" exists with password "StrongPass123!" in the same organization
    And another user "viewer@test.com" exists with password "StrongPass123!" in the same organization
    And another user "outsider@test.com" exists with password "StrongPass123!" in a different organization "Other Org"
    And an active form template named "Contact Template" with 3 fields exists
    And I create a form from template "Contact Template" with title "Shared Form" and description "Form for sharing tests"

  @Smoke
  Scenario: Owner shares form with VIEWER permission to specific member
    When I share the form with user "viewer@test.com" with "VIEWER" permission using scope "SPECIFIC_MEMBERS"
    Then the form sharing scope should be "SPECIFIC_MEMBERS"
    And user "viewer@test.com" should have "VIEWER" permission on the form
    When I switch to user "viewer@test.com"
    And I query forms with category "SHARED"
    Then I should see the form "Shared Form" in the results
    When I query the form by ID
    Then the form should have userPermission "VIEWER"

  Scenario: Owner shares form with EDITOR permission to specific member
    When I share the form with user "editor@test.com" with "EDITOR" permission using scope "SPECIFIC_MEMBERS"
    Then the form sharing scope should be "SPECIFIC_MEMBERS"
    And user "editor@test.com" should have "EDITOR" permission on the form
    When I switch to user "editor@test.com"
    And I query forms with category "SHARED"
    Then I should see the form "Shared Form" in the results
    When I query the form by ID
    Then the form should have userPermission "EDITOR"

  Scenario: Owner shares form with all organization members using ALL_ORG_MEMBERS scope
    When I share the form with scope "ALL_ORG_MEMBERS" and default permission "VIEWER"
    Then the form sharing scope should be "ALL_ORG_MEMBERS"
    And the form default permission should be "VIEWER"
    When I switch to user "editor@test.com"
    And I query forms with category "SHARED"
    Then I should see the form "Shared Form" in the results
    When I query the form by ID
    Then the form should have userPermission "VIEWER"
    When I switch to user "viewer@test.com"
    And I query forms with category "SHARED"
    Then I should see the form "Shared Form" in the results
    When I query the form by ID
    Then the form should have userPermission "VIEWER"

  Scenario: Owner updates permission level from VIEWER to EDITOR
    Given I share the form with user "editor@test.com" with "VIEWER" permission using scope "SPECIFIC_MEMBERS"
    When I update user "editor@test.com" permission to "EDITOR" on the form
    Then user "editor@test.com" should have "EDITOR" permission on the form
    When I switch to user "editor@test.com"
    And I query the form by ID
    Then the form should have userPermission "EDITOR"

  Scenario: Owner updates permission level from EDITOR to VIEWER
    Given I share the form with user "editor@test.com" with "EDITOR" permission using scope "SPECIFIC_MEMBERS"
    When I update user "editor@test.com" permission to "VIEWER" on the form
    Then user "editor@test.com" should have "VIEWER" permission on the form
    When I switch to user "editor@test.com"
    And I query the form by ID
    Then the form should have userPermission "VIEWER"

  Scenario: Owner removes form access from user
    Given I share the form with user "viewer@test.com" with "VIEWER" permission using scope "SPECIFIC_MEMBERS"
    When I remove user "viewer@test.com" access from the form
    Then user "viewer@test.com" should not have permission on the form
    When I switch to user "viewer@test.com"
    And I query forms with category "SHARED"
    Then I should not see the form "Shared Form" in the results

  Scenario: Cannot remove access from form owner
    When I try to remove user "owner@test.com" access from the form
    Then the operation should fail with error "Cannot remove access from form owner"

  Scenario: Cannot share form with user outside organization
    When I try to share the form with user "outsider@test.com" with "VIEWER" permission using scope "SPECIFIC_MEMBERS"
    Then the operation should fail with error "Cannot grant permissions to users outside organization"

  Scenario: Query formPermissions returns all granted permissions
    When I share the form with multiple users:
      | email              | permission |
      | editor@test.com    | EDITOR     |
      | viewer@test.com    | VIEWER     |
    And I query formPermissions for the form
    Then I should see 3 permissions in the list
    And user "editor@test.com" should be in the permissions list with "EDITOR" permission
    And user "viewer@test.com" should be in the permissions list with "VIEWER" permission

  Scenario: Query forms by category (OWNER, SHARED, ALL)
    Given I create another form from template "Contact Template" with title "My Private Form"
    And I share the form with user "editor@test.com" with "EDITOR" permission using scope "SPECIFIC_MEMBERS"
    When I query forms with category "OWNER"
    Then I should see 2 forms in the results
    When I query forms with category "SHARED"
    Then I should see 0 forms in the results
    When I switch to user "editor@test.com"
    And I query forms with category "OWNER"
    Then I should see 0 forms in the results
    When I query forms with category "SHARED"
    Then I should see 1 form in the results
    And I should see the form "Shared Form" in the results
    When I query forms with category "ALL"
    Then I should see 1 form in the results

  Scenario: Query organizationMembers returns all members
    When I query organizationMembers
    Then I should see 3 members in the list
    And user "owner@test.com" should be in the members list
    And user "editor@test.com" should be in the members list
    And user "viewer@test.com" should be in the members list

  Scenario: VIEWER cannot edit form
    Given I share the form with user "viewer@test.com" with "VIEWER" permission using scope "SPECIFIC_MEMBERS"
    When I switch to user "viewer@test.com"
    And I try to update the form title to "Hacked Form"
    Then the operation should fail with error "Access denied"
