@FormLifecycle
Feature: Form Lifecycle Management
  As a form creator
  I want to manage form creation, updates, and deletion
  So that I can maintain my forms throughout their lifecycle

  Background:
    Given the backend server is running
    And I have a test user with an organization

  @FormCreation
  Scenario: Create form from template successfully
    Given I have access to form templates
    When I create a form from the "Job Application Form" template with title "Engineering Position Application"
    Then the form should be created successfully
    And the form should have the correct title and template structure
    And the form should be unpublished by default
    And the form should have a unique short URL
    And I should be the owner of the form

  @FormCreation
  Scenario: Create form with custom description
    Given I have access to form templates
    When I create a form from the "Contact Form" template with:
      | title       | Customer Support Inquiry     |
      | description | For customer support issues  |
    Then the form should be created successfully
    And the form should have title "Customer Support Inquiry"
    And the form should have description "For customer support issues"

  @FormCreation @ErrorHandling
  Scenario: Fail to create form with invalid template
    Given I am authenticated
    When I attempt to create a form with invalid template ID "invalid-template-123"
    Then the form creation should fail
    And I should receive an error "Template not found"

  @FormCreation @ErrorHandling
  Scenario: Fail to create form without authentication
    Given I am not authenticated
    When I attempt to create a form from any template
    Then the form creation should fail
    And I should receive an authentication error

  @FormUpdate
  Scenario: Update form title and description
    Given I have created a form from a template
    When I update the form with:
      | title       | Updated Form Title       |
      | description | Updated form description |
    Then the form should be updated successfully
    And the form title should be "Updated Form Title"
    And the form description should be "Updated form description"

  @FormUpdate
  Scenario: Publish form
    Given I have created an unpublished form
    When I publish the form
    Then the form should be marked as published
    And the form should be accessible via its short URL

  @FormUpdate
  Scenario: Update form settings
    Given I have created a form from a template
    When I update the form settings with:
      | thankYou.enabled | true                           |
      | thankYou.message | Thank you for your submission! |
    Then the form settings should be updated successfully
    And the thank you message should be customized

  @FormUpdate @ErrorHandling @Permission
  Scenario: Fail to update form without proper permissions
    Given another user has created a form
    And I have VIEWER permission to that form
    When I attempt to update the form title
    Then the form update should fail
    And I should receive a permission error

  @FormUpdate @ErrorHandling @Permission
  Scenario: Fail to publish form without OWNER permission
    Given another user has created a form
    And I have EDITOR permission to that form
    When I attempt to publish the form
    Then the form update should fail
    And I should receive an error about requiring owner permissions

  @FormURL
  Scenario: Regenerate form short URL
    Given I have created and published a form
    And I note the current short URL
    When I regenerate the form's short URL
    Then a new short URL should be generated
    And the new URL should be different from the previous one
    And the form should be accessible via the new URL
    And the old URL should no longer work

  @FormURL @ErrorHandling @Permission
  Scenario: Fail to regenerate URL without EDITOR permission
    Given another user has created a form
    And I have VIEWER permission to that form
    When I attempt to regenerate the form's short URL
    Then the operation should fail
    And I should receive a permission error

  @FormDeletion
  Scenario: Delete form as owner
    Given I have created a form from a template
    And I note the form ID
    When I delete the form
    Then the form should be deleted successfully
    And the form should no longer be accessible
    And attempting to access the form should return "Form not found"

  @FormDeletion @ErrorHandling @Permission
  Scenario: Fail to delete form without OWNER permission
    Given another user has created a form
    And I have EDITOR permission to that form
    When I attempt to delete the form
    Then the form deletion should fail
    And I should receive an error that only the owner can delete the form
    And the form should still exist

  @FormDeletion @ErrorHandling
  Scenario: Fail to delete non-existent form
    Given I am authenticated
    When I attempt to delete a form with ID "non-existent-form-123"
    Then the form deletion should fail
    And I should receive an error about the form not being found

  @FormRetrieval
  Scenario: Retrieve form by ID with proper permissions
    Given I have created a form from a template
    When I retrieve the form by its ID
    Then I should receive the complete form data
    And the form should include metadata like field count and page count
    And the form should include my permission level

  @FormRetrieval
  Scenario: Retrieve published form by short URL
    Given I have created and published a form
    When I retrieve the form by its short URL without authentication
    Then I should receive the form data
    And the form schema should be included
    And no permission-sensitive data should be exposed

  @FormRetrieval @ErrorHandling @Permission
  Scenario: Fail to retrieve form without proper permissions
    Given another user has created a private form
    And I do not have access to that form
    When I attempt to retrieve the form by its ID
    Then the form retrieval should fail
    And I should receive an access denied error

  @FormRetrieval @ErrorHandling
  Scenario: Fail to retrieve unpublished form by short URL
    Given I have created an unpublished form
    When I attempt to retrieve the form by its short URL without authentication
    Then the form retrieval should fail
    And I should receive an error that the form is not published

  @BusinessRules
  Scenario: Form with submission limits
    Given I have created a form from a template
    When I configure the form with maximum 5 responses
    And I publish the form
    Then the form should enforce the response limit
    And the form should be accessible until the limit is reached

  @BusinessRules
  Scenario: Form with time window restrictions
    Given I have created a form from a template
    When I configure the form with time window from tomorrow to next week
    And I publish the form
    Then the form should not accept submissions before the start date
    And the form should accept submissions during the active period