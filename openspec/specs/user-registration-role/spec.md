# User Registration Role Specification

## Purpose
Defines the requirement that all newly registered users default to a standard user role (`IDRole = 2`) to prevent unauthorized escalation of privileges.

## Requirements

### Requirement: Default User Role Assignment
Every user registered through the signup process MUST be assigned `IDRole = 2` (Standard User) and the corresponding category name (e.g., `'User'`).

#### Scenario: Newly registered user has default role
- GIVEN a user registration request with valid name, email, and password
- WHEN the user registration usecase executes
- THEN the created user record in the database MUST have `IDRole` set to 2
- AND the user's category MUST resolve to "User"

#### Scenario: Role modification is ignored during public registration
- GIVEN a registration request containing an explicit administrative role parameter (e.g., `IDRole = 1`)
- WHEN the user registration request is processed
- THEN the system MUST ignore the provided role parameter
- AND default the user to `IDRole = 2`
