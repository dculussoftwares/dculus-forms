@FormViewer @E2E @Critical
Feature: Form viewer rendering with all field types
  To ensure forms are publicly accessible and render correctly
  Users should be able to view published forms at the public viewer URL

  Background:
    Given the database is clean
    And an organization owner "viewer-test@test.com" exists with password "StrongPass123!" and organization "Viewer Test Org"

  @Smoke
  Scenario: Published form with all field types renders in form viewer
    Given I create a comprehensive form with all field types titled "Comprehensive Test Form"
    When I publish the form
    Then the form should be accessible at the form viewer URL
    And all field types should be visible in the form viewer
    And the "text_input_field" should be rendered correctly
    And the "text_area_field" should be rendered correctly
    And the "email_field" should be rendered correctly
    And the "number_field" should be rendered correctly
    And the "date_field" should be rendered correctly
    And the "select_field" should be rendered correctly
    And the "radio_field" should be rendered correctly
    And the "checkbox_field" should be rendered correctly
    And the "rich_text_field" should be rendered correctly
