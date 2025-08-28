Feature: Health Check API
  As a system administrator
  I want to check the health status of the backend service
  So that I can monitor if the service is running properly

  Scenario: Get health status successfully
    When I send a GET request to "/health"
    Then the response status code should be 200
    And the response should contain "success" field with value true
    And the response should contain "message" field with value "Server is healthy"
    And the response should contain "timestamp" field
    And the response should contain "uptime" field

  Scenario: Health endpoint returns valid JSON
    When I send a GET request to "/health"
    Then the response status code should be 200
    And the response should be valid JSON
    And the response should have the correct content type