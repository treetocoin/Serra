# Feature Specification: Admin User Role with Multi-Project View

**Feature Branch**: `006-fammi-un-tipo`
**Created**: 2025-11-16
**Status**: Draft
**Input**: User description: "fammi un tipo di utente admin che può vedere i vari progetti degli iscritti. questo utente deve essere dadecresce@test.caz"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Views All User Projects (Priority: P1)

An admin user (dadecresce@test.caz) logs into the system and can see a comprehensive list of all registered users and their associated greenhouse projects. This allows the admin to monitor system usage, provide support, and manage the platform.

**Why this priority**: This is the core requirement - without the ability to view all projects, the admin role has no purpose. This is the MVP that delivers immediate value for platform administration.

**Independent Test**: Can be fully tested by logging in as dadecresce@test.caz and verifying that a list of all users and their projects is displayed, while regular users cannot access this view.

**Acceptance Scenarios**:

1. **Given** dadecresce@test.caz is logged in as admin, **When** they navigate to the admin dashboard, **Then** they see a list of all registered users with their associated projects
2. **Given** dadecresce@test.caz is logged in as admin, **When** they view the projects list, **Then** they can see project details including owner, devices, sensors, and actuators for each project
3. **Given** a regular user is logged in, **When** they try to access the admin dashboard, **Then** they are denied access and see only their own projects
4. **Given** dadecresce@test.caz is not logged in, **When** they try to access the admin dashboard URL directly, **Then** they are redirected to the login page

---

### User Story 2 - Admin Project Search and Filtering (Priority: P2)

The admin user can search and filter the list of projects by user email, project name, device count, or activity status to quickly find specific information.

**Why this priority**: As the number of users grows, the ability to search and filter becomes essential for platform management, but the basic list view (P1) must exist first.

**Independent Test**: Can be tested by creating multiple test users with projects, then using search/filter controls to verify results are correctly filtered.

**Acceptance Scenarios**:

1. **Given** admin is viewing all projects, **When** they type a user email in the search box, **Then** only projects belonging to that user are displayed
2. **Given** admin is viewing all projects, **When** they filter by "active in last 7 days", **Then** only projects with recent sensor readings are shown
3. **Given** admin is viewing all projects, **When** they filter by device count, **Then** projects are sorted or filtered by number of devices

---

### User Story 3 - Admin Edits User Project Configurations (Priority: P3)

The admin user can modify project configurations (add/edit/remove devices, sensors, actuators) for any user to help with troubleshooting or fixing configuration issues on behalf of users.

**Why this priority**: Edit capabilities are useful for support but require the view functionality (P1) to exist first. This is less critical than search/filter (P2) for daily admin tasks.

**Independent Test**: Can be tested by logging in as admin, selecting a user's project, making a configuration change (e.g., editing sensor name), and verifying the change persists and is visible to both admin and project owner.

**Acceptance Scenarios**:

1. **Given** admin is viewing a user's project details, **When** they edit a device configuration, **Then** the changes are saved and immediately visible to the project owner
2. **Given** admin is editing a user's project, **When** they add a new sensor, **Then** the sensor appears in the owner's dashboard without requiring a page refresh
3. **Given** admin is viewing a project, **When** they attempt to delete the entire project, **Then** the system prevents the deletion and shows an error message
4. **Given** admin has made changes to a user's project, **When** the project owner is actively using the app, **Then** the owner sees the changes reflected in real-time

---

### User Story 4 - Admin Views Detailed Project Information (Priority: P4)

The admin user can click on any project to see detailed information including all devices, sensors, actuators, and recent sensor readings for troubleshooting and support purposes.

**Why this priority**: This provides deeper visibility for support cases, but editing capabilities (P3) and search (P2) are more actionable for admins.

**Independent Test**: Can be tested by selecting any project from the admin list and verifying that full project details are displayed with real-time sensor data.

**Acceptance Scenarios**:

1. **Given** admin is viewing the projects list, **When** they click on a specific project, **Then** they see full project details including all devices, sensors, actuators, and recent readings
2. **Given** admin is viewing a project detail page, **When** they view sensor readings, **Then** they see the same data the project owner would see
3. **Given** admin is viewing a project detail page, **When** they navigate back, **Then** they return to the filtered/searched projects list with their previous filters intact

---

### Edge Cases

- What happens when an admin user (dadecresce@test.caz) modifies another user's project settings? Admin can edit/modify all project configurations (devices, sensors, actuators) but cannot delete entire projects or user accounts.
- How does the system handle viewing projects for users who have deleted their account but have historical data?
- What happens when there are thousands of registered users - how is pagination handled?
- How does the system differentiate between admin and regular users when both access the same routes?
- What happens if an admin edits a project while the owner is actively using it - are changes reflected in real-time?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a "user_role" field in the users table with values "user" and "admin"
- **FR-002**: System MUST automatically assign the "admin" role to the user with email "dadecresce@test.caz"
- **FR-003**: Admin users MUST be able to view a list of all registered users in the system
- **FR-004**: Admin users MUST be able to view all projects (greenhouses) associated with each registered user
- **FR-005**: System MUST display project information including: project name, owner email, number of devices, number of sensors, number of actuators, last activity timestamp
- **FR-006**: Regular users MUST NOT be able to access the admin dashboard or view other users' projects
- **FR-007**: System MUST enforce role-based access control at both the UI and API level
- **FR-008**: Admin users MUST see a dedicated admin navigation item or dashboard link
- **FR-009**: System MUST maintain existing user privacy - regular users cannot see each other's data
- **FR-010**: System MUST persist the user role across sessions (stored in database)
- **FR-011**: Admin users MUST be able to edit project configurations (devices, sensors, actuators) for any user
- **FR-012**: Admin users MUST NOT be able to delete entire projects or user accounts
- **FR-013**: System MUST clearly indicate when viewing/editing another user's project as admin
- **FR-014**: Changes made by admin to user projects MUST be immediately visible to the project owner

### Key Entities

- **User Role**: An attribute of a user indicating their permission level. Values: "user" (default for all new registrations) or "admin" (manually assigned). The user dadecresce@test.caz is the designated admin.
- **Admin Dashboard**: A view accessible only to admin users showing aggregated information about all users and their projects.
- **Project Ownership**: The relationship between a user and their greenhouse projects. Admin users can view all ownership relationships, regular users can only view their own.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin user (dadecresce@test.caz) can successfully view all registered users and their projects within 5 seconds of accessing the admin dashboard
- **SC-002**: Regular users attempting to access admin-only features receive an access denied response with 100% consistency
- **SC-003**: Admin can identify any user's project and view its details in under 10 seconds using search or filtering
- **SC-004**: System maintains security with zero instances of unauthorized access to admin features by regular users

## Assumptions *(mandatory)*

- The user dadecresce@test.caz will be manually created or seeded into the database with admin role
- Admin users have full edit permissions for other users' projects but cannot delete projects or users
- The existing project/greenhouse structure (users → projects → devices → sensors/actuators) remains unchanged
- Authentication and session management already exist in the system (Supabase Auth)
- The admin role is a simple binary flag (admin vs. user) - no complex permission system needed
- Admin dashboard will be a new page/route in the existing web application
- Pagination will use industry-standard approaches (e.g., 50-100 items per page)

## Dependencies

- Existing authentication system (Supabase Auth)
- Existing database schema for users, projects (sites), devices, sensors, actuators
- Existing Row Level Security (RLS) policies in Supabase may need updates to support admin access

## Out of Scope

- Multiple admin users with different permission levels (only one admin: dadecresce@test.caz)
- Admin ability to delete entire user projects or user accounts
- Admin ability to create new user accounts on behalf of users
- Admin ability to suspend or ban user accounts
- Audit logging of admin actions
- Admin analytics or reporting dashboards
- Email notifications to admin for new user registrations or issues
