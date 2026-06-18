# Visual Admin Hiding Specification

## Purpose
Specifies the conditional rendering of administrative controls in the EJS templates, ensuring standard users do not see options for creating, editing, or deleting products and users.

## Requirements

### Requirement: Admin Navigation Controls Hiding
In the main navigation header, links to administrative pages (such as the "Nuevo producto" form) MUST only be visible to logged-in users with administrator privileges (`IDRole === 1`).

#### Scenario: Admin sees the new product link
- GIVEN a user is logged in as an administrator (`locals.isLogged` is true and `locals.userLogged.IDRole === 1`)
- WHEN the header partial renders
- THEN the "Nuevo producto" link MUST be visible

#### Scenario: Standard user does not see the new product link
- GIVEN a user is logged in as a standard user (`locals.isLogged` is true and `locals.userLogged.IDRole === 2`)
- WHEN the header partial renders
- THEN the "Nuevo producto" link MUST NOT be visible

### Requirement: Admin Action Buttons Hiding in Views
Any product edit, product delete, or user delete buttons present in product cards, details pages, or user management lists MUST only be rendered if the logged-in user is an administrator.

#### Scenario: Standard user does not see user delete button
- GIVEN a standard user views a list of users
- WHEN the template renders a user card
- THEN the "Borrar" user form and button MUST NOT be rendered
