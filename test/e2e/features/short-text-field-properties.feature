@FieldProperties @ShortText @Collaboration
Feature: Short Text Field Properties and Validation
  As a form builder user
  I want to configure Short Text field properties and validation
  So that I can create forms with proper input validation and user experience

  Background:
    Given I have test credentials ready
    And I am signed in as a new user

  @FieldProperties @BasicSettings
  Scenario: Configure basic Short Text field properties
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Field Properties Test Form               |
      | Description   | Testing Short Text field properties     |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then I should see the field settings panel
    When I update the field properties:
      | Property    | Value                           |
      | Label       | Full Name                       |
      | Placeholder | Enter your full name            |
      | Hint        | Please enter first and last name|
      | Default     | John Doe                        |
      | Prefix      | Name:                           |
    And I click the Save button in field settings
    Then the field should display the updated properties
    And the changes should persist after page refresh

  @FieldProperties @CharacterLimits @Validation
  Scenario: Configure character limits for Short Text field
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Character Limits Test Form               |
      | Description   | Testing character limit validation       |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then I should see the field settings panel
    When I set the minimum length to "2"
    And I set the maximum length to "50"
    And I click the Save button in field settings
    Then the character limits should be saved successfully
    And I should see character count indicators in the form preview
    When I refresh the page
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then the minimum length should be "2"
    And the maximum length should be "50"

  @FieldProperties @CharacterLimits @ValidationErrors
  Scenario: Validate character limit constraints - Min greater than Max
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Character Limit Validation Test          |
      | Description   | Testing character limit constraint errors|
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then I should see the field settings panel
    When I set the minimum length to "50"
    And I set the maximum length to "10"
    Then I should see a validation error "Minimum length must be less than or equal to maximum length"
    And the Save button should be disabled in field settings

  @FieldProperties @RequiredValidation
  Scenario: Configure Short Text field as required
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Required Field Test Form                 |
      | Description   | Testing required field validation        |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then I should see the field settings panel
    When I toggle the "Required" setting to enabled
    And I click the Save button in field settings
    Then the field should show a required indicator
    And the required setting should persist after page refresh

  @FieldProperties @FormValidation @NegativeTest
  Scenario Outline: Validate field settings form inputs with invalid data
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Form Validation Test                     |
      | Description   | Testing form validation with bad inputs  |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then I should see the field settings panel
    When I clear the "<field>" input and enter "<value>"
    Then I should see the validation error "<error>"
    And the Save button should be disabled in field settings

    Examples:
      | field       | value | error                                     |
      | label       |       | Field label is required                   |
      | minLength   | -1    | Minimum length must be 0 or greater      |
      | maxLength   | 0     | Maximum length must be 1 or greater      |

  @FieldProperties @FormSubmission @Integration
  Scenario: Test form submission with character limit validation
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Form Submission Test                     |
      | Description   | Testing form submission with validation  |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    And I configure the field with character limits:
      | minLength  | 5  |
      | maxLength  | 20 |
      | required   | true |
    And I click the Save button in field settings
    When I navigate to the form preview
    And I enter "Hi" in the Short Text field
    Then I should see a validation error indicating minimum length requirement
    When I clear the field and enter "This is a very long text that definitely exceeds the maximum limit"
    Then I should see a validation error indicating maximum length exceeded
    When I clear the field and enter "Valid input"
    Then the field should be valid with no errors
    And I should be able to proceed with form submission

  @FieldProperties @SettingsPersistence
  Scenario: Verify field settings persistence after various operations
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Settings Persistence Test                |
      | Description   | Testing field settings persistence       |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then I should see the field settings panel
    When I configure comprehensive field settings:
      | Property    | Value                           |
      | Label       | Employee ID                     |
      | Placeholder | e.g. EMP001                     |
      | Hint        | Enter your employee identifier  |
      | Prefix      | ID:                             |
      | Required    | true                            |
      | minLength   | 3                               |
      | maxLength   | 15                              |
    And I click the Save button in field settings
    Then all field settings should be saved successfully
    When I click away to deselect the field
    And I click on the same field to select it again
    Then all the configured settings should be preserved
    When I refresh the page
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then all the configured settings should still be preserved

  @FieldProperties @SettingsCancel
  Scenario: Verify field settings cancel functionality
    When I click the "Create Form" button on dashboard
    Then I should be redirected to templates page
    When I select the "Event Registration" template
    And I fill in the form creation details:
      | Field Name    | Value                                    |
      | Form Title    | Settings Cancel Test                     |
      | Description   | Testing field settings cancel behavior   |
    And I click the "Create Form" button in the template popover
    Then I should be redirected to the form builder page
    When I navigate back to form dashboard
    And I click the Start Collaborating button in Quick Actions
    Then I should see the collaborative form builder interface
    When I select the "Personal Information" page from the sidebar
    And I click on the first Short Text field to select it
    Then I should see the field settings panel
    And I store the original field settings
    When I modify the field settings:
      | Property    | Value                           |
      | Label       | Modified Label                  |
      | Placeholder | Modified Placeholder            |
      | minLength   | 10                              |
      | maxLength   | 25                              |
    And I click the Cancel button in field settings
    Then the field settings should be reverted to original values
    And no changes should be applied to the field