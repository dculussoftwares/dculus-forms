Feature: Backend Health Check API
  As a system administrator
  I want to check the health status of the backend service
  So that I can monitor system availability and uptime

  Background:
    Given the backend service is running
    
  @smoke @health
  Scenario: Health endpoint returns successful response
    When I request the health check endpoint
    Then the response status should be 200
    And the response should be in JSON format
    And the response should contain success status
    And the success status should be true

  @smoke @health
  Scenario: Health endpoint returns proper response structure
    When I request the health check endpoint
    Then the response should contain the following fields:
      | field     | type    |
      | success   | boolean |
      | message   | string  |
      | timestamp | string  |
      | uptime    | number  |

  @performance @health
  Scenario: Health endpoint responds quickly
    When I request the health check endpoint
    Then the response time should be less than 1000 milliseconds

  @health
  Scenario: Health endpoint returns valid timestamp
    When I request the health check endpoint
    Then the timestamp should be a valid ISO date
    And the timestamp should be recent

  @health
  Scenario: Health endpoint returns positive uptime
    When I request the health check endpoint
    Then the uptime should be greater than 0
    And the uptime should be a number

  @integration @health
  Scenario: Multiple health check requests are consistent
    When I make 3 consecutive health check requests
    Then all responses should have status 200
    And all responses should have success status true
    And each uptime should be greater than or equal to the previous uptime