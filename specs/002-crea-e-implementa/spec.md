# Feature Specification: Actuator Management and Sensor-Actuator Automation

**Feature Branch**: `002-crea-e-implementa`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "crea e implementa la pagina della gestione degli attuatori ( funzionano come i sensori , quindi vanno rilevati dalla scheda) crea anche la pagina in cui si gestiscono gli algoritmi sensori-attuatori"

## Clarifications

### Session 2025-10-09

- Q: How should conflicting automation rules be handled when multiple rules try to control the same actuator simultaneously? → A: Priority system - users assign priority numbers to rules (1 = highest priority), with creation timestamp as tiebreaker for same-priority rules

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View and Manage Discovered Actuators (Priority: P1)

A greenhouse owner needs to view all actuators that have been auto-discovered from their connected ESP32 devices and customize their properties (names, descriptions) for easier identification and management.

**Why this priority**: This is the foundation for actuator control - users must be able to see and identify their actuators before they can control them manually or through automation rules.

**Independent Test**: Can be fully tested by connecting an ESP32 with actuators, verifying they appear in the actuator list, and customizing actuator properties. Delivers immediate value by providing visibility into available controls.

**Acceptance Scenarios**:

1. **Given** I have an ESP32 device with actuators connected, **When** the ESP32 reports its actuators to the system, **Then** I see all auto-discovered actuators listed with their device-assigned identifiers and types
2. **Given** I am viewing the actuator list, **When** I select an actuator, **Then** I see its details including type, current state, associated device, and last update timestamp
3. **Given** I want to identify an actuator easily, **When** I assign it a custom name (e.g., "Greenhouse Irrigation Pump"), **Then** the custom name is saved and displayed instead of the device identifier
4. **Given** I have multiple actuators across different devices, **When** I view the actuator management page, **Then** I see all actuators grouped by device with their current states
5. **Given** I want to organize my actuators, **When** I add descriptions or notes to actuators, **Then** this information is persisted and displayed in the actuator details

---

### User Story 2 - Configure Sensor-Actuator Automation Rules (Priority: P2)

A greenhouse owner needs to create automation rules that trigger actuator actions based on sensor readings, enabling automatic greenhouse environment management without manual intervention.

**Why this priority**: Automation is the primary value proposition of connecting sensors and actuators - it allows the greenhouse to self-regulate based on defined rules.

**Independent Test**: Can be tested by creating a simple rule (e.g., "turn on fan when temperature exceeds 30°C"), triggering the condition with sensor data, and verifying the actuator responds.

**Acceptance Scenarios**:

1. **Given** I have sensors and actuators configured, **When** I access the automation rules page, **Then** I see an interface to create new rules and view existing rules
2. **Given** I want to create an automation rule, **When** I define a condition based on a sensor reading (e.g., temperature > 30°C), **Then** I can specify which actuator should activate (e.g., ventilation fan turns on)
3. **Given** I am creating a rule, **When** I configure the trigger condition, **Then** I can choose from comparison operators (greater than, less than, equals, between) and specify threshold values
4. **Given** I want more complex automation, **When** I create a rule with multiple conditions (e.g., temperature > 30°C AND humidity < 60%), **Then** all conditions must be met for the actuator to trigger
5. **Given** I created an automation rule, **When** the sensor readings meet the specified conditions, **Then** the associated actuator command is queued and executed automatically
6. **Given** I have active automation rules, **When** I view the rules list, **Then** I see each rule's status (active/inactive), last trigger time, and trigger count

---

### User Story 3 - Manage and Monitor Automation Rule Behavior (Priority: P3)

A greenhouse owner needs to enable/disable automation rules, monitor their execution history, and adjust rule parameters based on observed results.

**Why this priority**: Users need control over automation behavior and visibility into what rules are doing to build confidence and optimize greenhouse management.

**Independent Test**: Can be tested by creating a rule, toggling it on/off, reviewing its execution history, and modifying its parameters.

**Acceptance Scenarios**:

1. **Given** I have automation rules configured, **When** I want to temporarily stop automation, **Then** I can disable specific rules without deleting them
2. **Given** I disabled a rule, **When** sensor conditions that would trigger it occur, **Then** the rule does not execute and the actuator is not triggered
3. **Given** I want to understand rule behavior, **When** I view a rule's history, **Then** I see a log of all past executions with timestamps and sensor values that triggered them
4. **Given** I want to adjust automation parameters, **When** I edit a rule's threshold values or conditions, **Then** the updated rule takes effect immediately
5. **Given** I no longer need a rule, **When** I delete it, **Then** it is removed and will not trigger in the future
6. **Given** multiple rules could affect the same actuator, **When** conflicting rules trigger simultaneously, **Then** the rule with the highest priority (lowest priority number) takes control of the actuator
7. **Given** I want to control which rule wins in conflicts, **When** I create or edit a rule, **Then** I can assign a priority number (1 = highest priority, higher numbers = lower priority)
8. **Given** two rules with the same priority affect the same actuator, **When** both trigger simultaneously, **Then** the most recently created rule takes precedence

---

### User Story 4 - Advanced Automation with Schedules and Hysteresis (Priority: P4)

A greenhouse owner needs to create time-based automation rules and implement hysteresis to prevent rapid actuator switching when sensor values oscillate near thresholds.

**Why this priority**: Advanced features enhance automation quality but are not essential for basic automatic greenhouse management.

**Independent Test**: Can be tested by creating a scheduled rule (e.g., "water plants at 7 AM daily") and a hysteresis rule (e.g., "turn on heater at 15°C, turn off at 18°C").

**Acceptance Scenarios**:

1. **Given** I want time-based control, **When** I create a schedule-based rule, **Then** I can specify times of day or days of week when an actuator should activate
2. **Given** I have a scheduled rule, **When** the scheduled time arrives, **Then** the actuator activates regardless of sensor conditions
3. **Given** I want to prevent rapid switching, **When** I configure a rule with hysteresis, **Then** I can define different on-threshold and off-threshold values (e.g., turn on at 15°C, turn off at 18°C)
4. **Given** I have a hysteresis rule active, **When** sensor values oscillate near a single threshold, **Then** the actuator does not rapidly cycle on and off

---

### Edge Cases

- What happens when a sensor referenced in an automation rule goes offline or stops reporting data?
- How does the system handle automation rules when the target actuator's ESP32 device is offline?
- What happens when a user creates a rule with physically impossible conditions (e.g., temperature > 100°C in typical greenhouse)?
- How does the system prevent infinite loops (e.g., actuator triggers sensor change which triggers actuator again)?
- What happens when a user deletes a sensor or actuator that is referenced in active automation rules?
- How does the system handle very high-frequency rule evaluations if sensor data arrives rapidly?
- What happens when conflicting automation rules both try to control the same actuator simultaneously?
- How does the system handle automation rule execution when sensor data is corrupted or invalid?
- What happens if a user changes time zones and has schedule-based automation rules?

## Requirements *(mandatory)*

### Functional Requirements

**Actuator Management Interface**

- **FR-001**: System MUST provide a dedicated page listing all auto-discovered actuators from all registered ESP32 devices
- **FR-002**: System MUST display actuator details including type, current state, associated device name, and last update timestamp
- **FR-003**: System MUST allow users to assign custom names to actuators for easier identification
- **FR-004**: System MUST allow users to add descriptions or notes to actuators
- **FR-005**: System MUST group actuators by their associated ESP32 device in the list view
- **FR-006**: System MUST display real-time actuator state (on/off/active percentage) in the actuator list
- **FR-007**: System MUST indicate when an actuator's device is offline or unreachable

**Automation Rules Engine**

- **FR-008**: System MUST provide a dedicated page for creating and managing sensor-actuator automation rules
- **FR-009**: System MUST allow users to create rules that trigger actuator actions based on sensor reading conditions
- **FR-010**: System MUST support comparison operators for rule conditions (greater than, less than, equals, not equals, between)
- **FR-011**: System MUST allow users to specify threshold values for sensor-based triggers
- **FR-012**: System MUST support multiple conditions within a single rule using AND/OR logic
- **FR-013**: System MUST allow users to specify which actuator action to perform when rule conditions are met (turn on, turn off, set to value)
- **FR-014**: System MUST evaluate active automation rules continuously based on incoming sensor data
- **FR-015**: System MUST automatically queue actuator commands when rule conditions are satisfied
- **FR-016**: System MUST prevent rule execution when the target actuator's device is offline

**Rule Management**

- **FR-017**: System MUST allow users to enable or disable automation rules without deleting them
- **FR-018**: System MUST display rule status (active/inactive) in the rules list
- **FR-019**: System MUST allow users to edit existing automation rules
- **FR-020**: System MUST allow users to delete automation rules
- **FR-021**: System MUST log all rule executions with timestamps and triggering sensor values
- **FR-022**: System MUST display rule execution history to users
- **FR-023**: System MUST show last trigger time and total trigger count for each rule
- **FR-024**: System MUST validate rules before activation (ensure referenced sensors and actuators exist)
- **FR-025**: System MUST handle conflicts when automation rule references are deleted or become unavailable

**Rule Priority and Conflict Resolution**

- **FR-033**: System MUST allow users to assign a priority number to each automation rule
- **FR-034**: System MUST resolve conflicts between rules affecting the same actuator by executing the rule with the highest priority (lowest priority number)
- **FR-035**: System MUST use rule creation timestamp as tiebreaker when multiple rules have the same priority (most recently created wins)
- **FR-036**: System MUST display rule priority in the rules list interface

**Advanced Automation Features**

- **FR-026**: System MUST support time-based and schedule-based automation rules (specific times, days of week)
- **FR-027**: System MUST support hysteresis in automation rules (different on-threshold and off-threshold values)
- **FR-028**: System MUST prevent rapid actuator cycling by enforcing minimum time between state changes

**Safety and Validation**

- **FR-029**: System MUST validate sensor threshold values are within reasonable physical ranges for the sensor type
- **FR-030**: System MUST prevent infinite automation loops by detecting circular rule dependencies
- **FR-031**: System MUST notify users when automation rules cannot execute due to missing sensors or offline devices
- **FR-032**: System MUST log all automation-triggered actuator commands separately from manual commands

### Key Entities

- **Actuator**: Previously defined in FR-001, now enhanced with custom name, description, and automation associations
- **Automation Rule**: Represents a sensor-to-actuator logic with rule name, priority number (for conflict resolution), status (active/inactive), trigger conditions (sensor, operator, threshold value), target actuator and action, logical operators (AND/OR) for multiple conditions, creation and last modified timestamps, execution count, and last trigger timestamp
- **Rule Condition**: Represents a single trigger criterion with sensor reference, comparison operator, threshold value(s), and AND/OR relationship to other conditions
- **Rule Execution Log**: Represents a historical rule trigger with timestamp, rule identifier, sensor values that triggered the rule, actuator command issued, and execution success/failure status
- **Schedule**: Represents time-based trigger with time of day, days of week, recurrence pattern, and associated automation rule
- **Hysteresis Configuration**: Represents anti-oscillation settings with on-threshold value, off-threshold value, minimum time between state changes, and associated automation rule

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all their actuators and customize names/descriptions in under 2 minutes
- **SC-002**: Users can create a basic automation rule (single condition, single actuator) in under 3 minutes
- **SC-003**: Automation rules evaluate and execute within 10 seconds of sensor conditions being met
- **SC-004**: System supports at least 50 active automation rules per user account without performance degradation
- **SC-005**: 90% of automation rule executions complete successfully when devices are online
- **SC-006**: Users can review complete rule execution history for any time period
- **SC-007**: System prevents actuator rapid cycling with hysteresis, maintaining minimum 60-second intervals between state changes
- **SC-008**: 85% of users successfully create their first automation rule without support assistance

## Assumptions *(optional)*

- Users have already completed initial system setup including authentication and ESP32 device registration (from feature 001)
- Users have functional sensors and actuators auto-discovered from ESP32 devices
- Users understand basic greenhouse management concepts (temperature ranges, humidity levels, watering schedules)
- Automation rules execute based on most recent sensor data available in the system
- Rule evaluation frequency aligns with ESP32 polling intervals (30-60 seconds typical)
- Users access automation features from desktop or tablet devices with adequate screen space
- Time-based schedules use the user's local time zone
- Users accept that automation execution has latency based on ESP32 polling cycles

## Dependencies *(optional)*

- Feature 001 (Home Greenhouse Management System) must be implemented and operational
- ESP32 firmware must support actuator auto-discovery and reporting
- ESP32 firmware must poll for queued commands at regular intervals to enable timely automation execution
- System must have real-time or near-real-time sensor data ingestion from ESP32 devices
- Actuator management page requires authenticated user session
- Rule evaluation engine requires persistent storage for rules and execution logs

## Out of Scope *(optional)*

- Machine learning or AI-based predictive automation
- Integration with weather forecast APIs for proactive automation adjustments
- Mobile push notifications when automation rules trigger
- Voice control or integration with smart home assistants
- Multi-variable optimization algorithms (e.g., balancing temperature, humidity, and light together)
- Historical data analysis tools for optimizing rule thresholds
- Rule templates or sharing automation rules with other users
- Simulation or testing mode for automation rules
- Advanced actuator types beyond simple on/off and value-setting (e.g., servo motor positioning)
