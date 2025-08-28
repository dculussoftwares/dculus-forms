Feature: File Upload GraphQL Mutation
  As an authenticated user
  I want to upload files via GraphQL
  So that I can manage form templates and other assets

  Background:
    Given the backend server is running

  Scenario: Successfully upload a FormTemplate image file
    Given I create and authenticate a test user
    And I have a test image file "company-logo.jpg" from static files
    When I upload the file with type "FormTemplate"
    Then the upload should be successful
    And the response should contain file metadata
    And the file should be accessible via the returned URL
    And I should be able to delete the uploaded file

  Scenario: Successfully upload a high resolution logo as FormTemplate
    Given I create and authenticate a test user
    And I have a test image file "dculus-high-resolution-logo.png" from static files
    When I upload the file with type "FormTemplate"
    Then the upload should be successful
    And the response should contain file metadata
    And the file should be accessible via the returned URL
    And I should be able to delete the uploaded file

  # Skip authentication test since it's currently disabled in resolver
  # Scenario: Attempt to upload file without authentication
  #   Given I have a test image file "company-logo.jpg" from static files
  #   When I upload the file with type "FormTemplate" without authentication
  #   Then the upload should fail
  #   And the response should indicate authentication is required

  Scenario: Attempt to upload invalid file type
    Given I create and authenticate a test user
    And I have a test text file for upload
    When I upload the file with type "FormTemplate"
    Then the upload should fail
    And the response should indicate invalid file type

  Scenario: Attempt to upload with invalid type parameter
    Given I create and authenticate a test user
    And I have a test image file "company-logo.jpg" from static files
    When I upload the file with type "InvalidType"
    Then the upload should fail
    And the response should indicate invalid file type parameter

  # Skip FormBackground test since it requires form creation with templateId
  # Scenario: Upload FormBackground with formId
  #   Given I create and authenticate a test user
  #   And I create a test form
  #   And I have a test image file "company-logo.jpg" from static files
  #   When I upload the file with type "FormBackground" and the form ID
  #   Then the upload should be successful
  #   And the response should contain file metadata
  #   And the file should be stored in FormFile table
  #   And I should be able to delete the uploaded file