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
    And I attach a file to the file upload field in viewer
    Then the file upload error should be cleared
