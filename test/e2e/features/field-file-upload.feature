@field-file-upload
Feature: File Upload Field

  Background:
    Given I sign in with valid credentials

  @field-file-upload
  Scenario: Configure file upload field settings in the builder
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a file upload field onto the page
    And I open the file upload field settings
    Then I fill the file upload field settings with valid data
    And I save the file upload field settings

  @field-file-upload @file-upload-viewer
  Scenario: Validate file upload required validation in form viewer
    When I create a form via GraphQL with file upload field
    Then I should be on the new form dashboard
    When I publish the form
    And I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I test required validation for file upload in viewer

  @field-file-upload @file-upload-invalid-builder
  Scenario: Validate file upload field settings with invalid data in builder
    When I create a form from the first template
    Then I should be on the new form dashboard
    When I open the collaborative builder
    And I add a new page in the builder
    And I drag a file upload field onto the page
    And I open the file upload field settings
    Then I test file upload label required validation
    And I test file upload label too long validation
    And I test file upload hint too long validation
    And I fix all validation errors for file upload
    And I verify save button is enabled
    And I save the file upload field settings

  @field-file-upload @file-upload-maxfiles
  Scenario: maxFiles constraint caps accepted files at the configured limit
    When I create a form via GraphQL with file upload maxFiles constraint
    Then I should be on the new form dashboard
    When I publish the form
    And I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I attach 3 files to the multi-file upload field
    Then only 2 files should be listed in the upload field
    And the upload drop zone should be hidden

  @field-file-upload @file-upload-mime
  Scenario: Unsupported MIME type is silently rejected by the file input
    When I create a form via GraphQL with file upload PDF only constraint
    Then I should be on the new form dashboard
    When I publish the form
    And I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I attach a txt file to the PDF-only upload field
    Then no file should be listed in the upload field

  @field-file-upload @file-upload-size
  Scenario: File exceeding size limit is silently rejected by the file input
    When I create a form via GraphQL with file upload size constraint
    Then I should be on the new form dashboard
    When I publish the form
    And I get the form short URL
    And I navigate to the form viewer with the short URL
    Then I should see the form in the viewer
    When I attach an oversized file to the size-limited upload field
    Then no file should be listed in the upload field
