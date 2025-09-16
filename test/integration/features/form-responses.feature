@FormResponses
Feature: Form Response Management
  As a form user and form creator
  I want to submit responses and manage response data
  So that I can collect and analyze form submissions

  Background:
    Given the backend server is running
    And I have a test user with an organization
    And I have a published form for testing responses

  @ResponseSubmission
  Scenario: Submit response to published form successfully
    Given I am viewing the form as a public user
    When I submit a response with valid form data
    Then the response should be submitted successfully
    And I should receive a confirmation message
    And the response should be stored in the database
    And the form's response count should increase

  @ResponseSubmission
  Scenario: Submit response with custom thank you message
    Given the form has a custom thank you message "Thanks for applying! We'll review your application within 3 business days."
    When I submit a response with valid form data
    Then the response should be submitted successfully
    And I should receive the custom thank you message
    And the custom thank you flag should be set to true

  @ResponseSubmission
  Scenario: Submit response with mention substitution in thank you message
    Given the form has a thank you message with field mentions "Thank you {{name}}! We received your application for {{position}}."
    And the form has fields for "name" and "position"
    When I submit a response with:
      | name     | John Doe        |
      | position | Senior Engineer |
    Then the response should be submitted successfully
    And the thank you message should show "Thank you John Doe! We received your application for Senior Engineer."

  @ResponseSubmission @Analytics
  Scenario: Submit response with analytics tracking
    Given I am viewing the form as a public user
    When I submit a response with analytics data:
      | sessionId              | unique-session-123      |
      | userAgent              | Mozilla/5.0 Chrome      |
      | timezone               | America/New_York        |
      | language               | en-US                   |
      | completionTimeSeconds  | 45                      |
    Then the response should be submitted successfully
    And the analytics data should be tracked
    And the submission analytics should include the completion time

  @ResponseSubmission @Validation
  Scenario: Submit response with field validation
    Given the form has required fields and validation rules
    When I submit a response with all required fields filled
    Then the response should be submitted successfully
    And all field data should be properly validated and stored

  @ResponseSubmission @ErrorHandling
  Scenario: Fail to submit response to unpublished form
    Given I have an unpublished form
    When I attempt to submit a response to the unpublished form
    Then the response submission should fail
    And I should receive an error that the form is not published

  @ResponseSubmission @ErrorHandling
  Scenario: Fail to submit response to non-existent form
    When I attempt to submit a response to form with ID "non-existent-form-123"
    Then the response submission should fail
    And I should receive an error that the form was not found

  @BusinessRules @SubmissionLimits
  Scenario: Form reaches maximum response limit
    Given the form is configured with a maximum of 2 responses
    And I have already submitted 2 responses to the form
    When I attempt to submit another response
    Then the response submission should fail
    And I should receive an error that the form has reached its response limit
    And no additional response should be stored

  @BusinessRules @TimeWindow
  Scenario: Submit response outside time window - before start date
    Given the form has a time window starting tomorrow
    When I attempt to submit a response today
    Then the response submission should fail
    And I should receive an error that the form is not yet open for submissions

  @BusinessRules @TimeWindow
  Scenario: Submit response outside time window - after end date
    Given the form has a time window that ended yesterday
    When I attempt to submit a response today
    Then the response submission should fail
    And I should receive an error that the form submission period has ended

  @BusinessRules @TimeWindow
  Scenario: Submit response within active time window
    Given the form has a time window from yesterday to tomorrow
    When I submit a response with valid form data
    Then the response should be submitted successfully
    And the response should be stored normally

  @ResponseRetrieval
  Scenario: Retrieve responses for a form with pagination
    Given I am authenticated as the form creator
    And the form has 15 submitted responses
    When I retrieve responses for the form with:
      | page    | 2  |
      | limit   | 5  |
      | sortBy  | submittedAt |
      | sortOrder | desc |
    Then I should receive 5 responses
    And the responses should be sorted by submission date descending
    And the pagination info should show page 2 of 3
    And the total count should be 15

  @ResponseRetrieval
  Scenario: Retrieve responses with filtering
    Given I am authenticated as the form creator
    And the form has responses with various field values
    When I retrieve responses with filters:
      | fieldId   | name               |
      | operator  | CONTAINS           |
      | value     | John               |
    Then I should receive only responses where name contains "John"
    And the response count should match the filter criteria

  @ResponseRetrieval @ErrorHandling
  Scenario: Fail to retrieve responses without authentication
    Given I am not authenticated
    When I attempt to retrieve responses for any form
    Then the response retrieval should fail
    And I should receive an authentication error

  @ResponseRetrieval @ErrorHandling
  Scenario: Fail to retrieve responses without proper permissions
    Given another user has created a form with responses
    And I do not have access to that form
    When I attempt to retrieve responses for that form
    Then the response retrieval should fail
    And I should receive an access denied error

  @ResponseDeletion
  Scenario: Delete response as authorized user
    Given I am authenticated as the form creator
    And the form has a submitted response
    And I note the response ID and current response count
    When I delete the response
    Then the response should be deleted successfully
    And the response should no longer exist in the database
    And the form's response count should decrease

  @ResponseDeletion @ErrorHandling
  Scenario: Fail to delete response without authentication
    Given I am not authenticated
    And there is a response to delete
    When I attempt to delete the response
    Then the response deletion should fail
    And I should receive an authentication error
    And the response should still exist

  @ResponseDeletion @ErrorHandling
  Scenario: Fail to delete non-existent response
    Given I am authenticated as the form creator
    When I attempt to delete a response with ID "non-existent-response-123"
    Then the response deletion should fail
    And I should receive an error that the response was not found

  @ResponseData
  Scenario: Submit response with various field types
    Given the form has fields of different types:
      | type      | id           | label              |
      | TextInput | firstName    | First Name         |
      | Email     | email        | Email Address      |
      | Number    | age          | Age                |
      | Select    | country      | Country            |
      | Radio     | gender       | Gender             |
      | Checkbox  | interests    | Interests          |
      | Date      | birthDate    | Birth Date         |
      | TextArea  | comments     | Additional Comments |
    When I submit a response with data for all field types:
      | firstName | John                    |
      | email     | john@example.com        |
      | age       | 30                      |
      | country   | United States           |
      | gender    | Male                    |
      | interests | Technology,Sports       |
      | birthDate | 1994-01-15             |
      | comments  | Looking forward to this |
    Then the response should be submitted successfully
    And all field data should be stored correctly with proper types
    And the form schema should match the submitted data structure

  @ResponseData @Validation
  Scenario: Validate email field format
    Given the form has an email field
    When I submit a response with an invalid email "not-an-email"
    Then the response should be submitted successfully
    But the system should handle the invalid email gracefully

  @ResponseData @Validation
  Scenario: Validate number field constraints
    Given the form has a number field with min 1 and max 100
    When I submit a response with number value 150
    Then the response should be submitted successfully
    But the system should store the value as provided

  @ResponseMetrics
  Scenario: Track response submission metrics
    Given I am authenticated as the form creator
    And the form is published
    When multiple responses are submitted over time
    Then the form's dashboard stats should be updated
    And the response counts should be accurate for:
      | period     |
      | today      |
      | this_week  |
      | this_month |
    And the response rate should be calculated correctly

  @ResponseExport
  Scenario: Generate response export report
    Given I am authenticated as the form creator
    And the form has multiple responses
    When I generate a response report in "CSV" format
    Then the export should be generated successfully
    And I should receive a download URL
    And the export should contain all response data
    And the export should include proper column headers

  @ResponseExport @Filtering
  Scenario: Generate filtered response export
    Given I am authenticated as the form creator
    And the form has responses with various data
    When I generate a response report with filters:
      | fieldId   | status    |
      | operator  | EQUALS    |
      | value     | approved  |
    And export format "EXCEL"
    Then the export should be generated successfully
    And the export should contain only filtered responses
    And the format should be Excel format