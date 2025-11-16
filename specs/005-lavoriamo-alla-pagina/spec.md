# Feature Specification: Pagina Dati (Sensor Data Page)

**Feature Branch**: `005-lavoriamo-alla-pagina`
**Created**: 2025-11-14
**Status**: Draft
**Input**: User description: "lavoriamo alla pagina 'Storico sensori: si deve chiamare 'Dati'. è una serra indoor quindi i dati che avremo sono T e H all'altezza della lampada e all'altezza del terreno, umidità del suolo, livello della soluzione nutritiva nel tank. voglio che sia ordinata, semplice e professionale"

## Clarifications

### Session 2025-11-14

- Q: How should temperature/humidity comparisons be visualized? → A: Overlaid on single graph - Both lamp height and ground level plotted as different colored lines on one chart per sensor type
- Q: How frequently should current sensor readings automatically refresh on the page? → A: Every 1 minute
- Q: What should users see when they navigate to "Dati" page with no sensors configured? → A: Setup wizard prompt - Show an onboarding flow that guides users through sensor configuration
- Q: How long should historical sensor data be retained in the system? → A: Keep all data indefinitely with smart downsampling: full granularity (5-minute intervals) for 0-15 days, then downsample to 30-minute intervals for older data
- Q: How should gaps in time-series data be displayed in graphs? → A: Connect with dotted line - Use dotted/dashed line through gap area to maintain visual continuity while indicating missing data

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Current Environmental Conditions (Priority: P1)

As a greenhouse operator, I want to see the current temperature and humidity at two height levels (lamp height and ground level), soil moisture, and nutrient solution tank level so I can quickly assess the current state of my indoor greenhouse environment.

**Why this priority**: This is the core value of the page - giving users immediate visibility into critical environmental parameters. Without this, the feature provides no value.

**Independent Test**: Can be fully tested by navigating to the "Dati" page and verifying that all four sensor types (temp/humidity at lamp height, temp/humidity at ground level, soil moisture, tank level) display their most recent readings with timestamps.

**Acceptance Scenarios**:

1. **Given** the user has active sensors in their greenhouse, **When** they navigate to the "Dati" page, **Then** they see current readings for temperature and humidity at lamp height
2. **Given** the user has active sensors in their greenhouse, **When** they navigate to the "Dati" page, **Then** they see current readings for temperature and humidity at ground level
3. **Given** the user has active sensors in their greenhouse, **When** they navigate to the "Dati" page, **Then** they see current readings for soil moisture level
4. **Given** the user has active sensors in their greenhouse, **When** they navigate to the "Dati" page, **Then** they see current readings for nutrient solution tank level
5. **Given** sensor data exists, **When** viewing current readings, **Then** each reading shows when it was last updated

---

### User Story 2 - View Historical Trends (Priority: P2)

As a greenhouse operator, I want to see historical trends for each sensor type over different time periods so I can identify patterns, anomalies, and optimize my greenhouse conditions.

**Why this priority**: After seeing current conditions, users need historical context to make informed decisions about adjustments and to understand trends over time.

**Independent Test**: Can be fully tested by selecting different time ranges (last 24 hours, last 7 days, last 30 days) and verifying that graphs display historical data with proper time scaling and values.

**Acceptance Scenarios**:

1. **Given** the user is on the "Dati" page, **When** they select a time range (e.g., last 24 hours), **Then** they see graphs showing historical data for all sensor types within that period
2. **Given** the user is viewing historical data, **When** they switch to a different time range, **Then** the graphs update to show data for the new time period
3. **Given** historical data exists, **When** viewing graphs, **Then** each sensor type has a clearly labeled graph with appropriate units (°C, %, cm, etc.)
4. **Given** the user hovers over a data point on a graph, **When** the cursor is over the point, **Then** they see the exact value and timestamp for that reading

---

### User Story 3 - Compare Environmental Zones (Priority: P3)

As a greenhouse operator, I want to compare temperature and humidity readings between lamp height and ground level so I can understand the environmental gradient in my greenhouse and identify ventilation or heating issues.

**Why this priority**: This adds analytical value by helping users understand the vertical environmental stratification, which is important for plant health but secondary to simply viewing the data.

**Independent Test**: Can be fully tested by verifying that temperature and humidity graphs display lamp height and ground level measurements as different colored lines overlaid on the same chart, with both lines clearly distinguishable.

**Acceptance Scenarios**:

1. **Given** the user is viewing temperature data, **When** they look at the temperature graph, **Then** they can clearly distinguish between lamp height temperature and ground level temperature
2. **Given** the user is viewing humidity data, **When** they look at the humidity graph, **Then** they can clearly distinguish between lamp height humidity and ground level humidity
3. **Given** both height levels have data, **When** viewing comparison, **Then** the difference between the two levels is visually apparent

---

### User Story 4 - Identify Data Gaps (Priority: P3)

As a greenhouse operator, I want to be informed when sensor data is missing or outdated so I can troubleshoot connectivity or sensor issues before they affect my crops.

**Why this priority**: This is a defensive feature that helps maintain data quality but doesn't add new analytical capabilities.

**Independent Test**: Can be fully tested by simulating a sensor that hasn't reported in the expected time window and verifying that the UI indicates the data is stale or missing.

**Acceptance Scenarios**:

1. **Given** a sensor hasn't reported data for more than 15 minutes, **When** the user views the "Dati" page, **Then** they see a visual indicator that the sensor data is stale
2. **Given** a sensor has never reported data, **When** the user views the "Dati" page, **Then** they see a placeholder indicating no data is available for that sensor
3. **Given** sensor data becomes stale, **When** the user is actively viewing the page, **Then** the indicator updates to reflect the stale status

---

### Edge Cases

- **No sensors configured**: Users see an onboarding wizard that guides them to device management functionality to add sensors
- **Large historical datasets**: System handles months/years of data through automatic downsampling (30-minute intervals for data older than 15 days) to maintain query performance
- **Missing data points in graphs**: Gaps in time series are displayed with dotted/dashed lines connecting the gap period to maintain visual continuity while indicating data absence
- What happens when a sensor type has only one data point (insufficient for meaningful graphing)?
- What happens if sensor readings are outside expected ranges (negative values, impossibly high values)?
- How does the page behave on mobile devices with limited screen space for multiple graphs?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the page with the title "Dati" (not "Storico sensori")
- **FR-002**: System MUST display current readings for temperature at lamp height with units and timestamp
- **FR-003**: System MUST display current readings for humidity at lamp height with units and timestamp
- **FR-004**: System MUST display current readings for temperature at ground level with units and timestamp
- **FR-005**: System MUST display current readings for humidity at ground level with units and timestamp
- **FR-006**: System MUST display current readings for soil moisture with units and timestamp
- **FR-007**: System MUST display current readings for nutrient solution tank level with units and timestamp
- **FR-008**: System MUST provide time range selection with at minimum: last 24 hours, last 7 days, last 30 days
- **FR-009**: System MUST display historical data as line graphs for each sensor type
- **FR-010**: System MUST clearly label each graph with sensor type and units
- **FR-011**: System MUST allow users to view exact values and timestamps by interacting with graph data points
- **FR-012**: System MUST display temperature measurements for lamp height and ground level as differently colored lines overlaid on a single temperature graph with a legend indicating which line represents each height
- **FR-013**: System MUST display humidity measurements for lamp height and ground level as differently colored lines overlaid on a single humidity graph with a legend indicating which line represents each height
- **FR-014**: System MUST indicate when sensor data is stale (no updates for more than 15 minutes)
- **FR-015**: System MUST indicate when no data exists for a sensor type
- **FR-016**: System MUST display an onboarding wizard when no sensors are configured, guiding users to device management functionality to add sensors
- **FR-017**: System MUST present data in an organized, simple, and professional layout
- **FR-018**: System MUST handle missing data points in graphs by connecting gap periods with dotted or dashed lines to maintain visual continuity while clearly indicating data absence (no interpolation of values)
- **FR-019**: System MUST refresh current readings automatically every 1 minute without requiring page reload
- **FR-020**: System MUST use appropriate decimal precision for each sensor type (temperature: 1 decimal, humidity: 0 decimals, soil moisture: 0 decimals, tank level: measurement-dependent)
- **FR-021**: System MUST retain sensor readings at full granularity (5-minute intervals) for the most recent 15 days
- **FR-022**: System MUST retain sensor readings older than 15 days at downsampled granularity (30-minute intervals) indefinitely

### Key Entities

- **Sensor Reading**: Represents a single measurement from a sensor at a specific point in time, including sensor type (temperature, humidity, soil moisture, tank level), measurement location (lamp height, ground level, soil, tank), value, unit of measurement, timestamp, and sampling interval (5-minute for recent data, 30-minute for historical data older than 15 days)
- **Time Range**: Represents a user-selected period for viewing historical data, with start and end timestamps
- **Sensor Status**: Represents the current operational state of a sensor, indicating whether it is active, stale, or has never reported data
- **Data Retention Policy**: Defines the lifecycle of sensor readings - full granularity (5-minute intervals) retained for 0-15 days, automatic downsampling to 30-minute intervals for data older than 15 days, with indefinite retention of downsampled data

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view current readings for all six sensor data points (temp/humidity at two heights, soil moisture, tank level) within 2 seconds of page load
- **SC-002**: Users can switch between time ranges and see updated graphs within 1 second
- **SC-003**: Users can identify data gaps or stale sensors within 5 seconds of viewing the page
- **SC-004**: The page layout remains organized and readable on screens from mobile (320px width) to desktop (1920px+ width)
- **SC-005**: Users can interpret the difference between lamp height and ground level conditions without training or documentation
- **SC-006**: 95% of users can successfully locate a specific sensor reading value from a past time period within 30 seconds
- **SC-007**: The page loads and displays multi-year historical data (through automatic downsampling to 30-minute intervals after 15 days) without performance degradation
- **SC-008**: Users report the page as "professional and easy to understand" in post-deployment feedback

## Assumptions *(mandatory)*

- Sensors are already configured and reporting data through existing device management functionality
- Each sensor type (temperature, humidity, soil moisture, tank level) has a unique identifier that associates readings with the correct location (lamp height vs ground level)
- Historical data is stored with sufficient granularity for meaningful time-series visualization
- The existing backend provides an API or data access method for retrieving current and historical sensor readings
- Users access the page through a web browser (desktop or mobile)
- Sensor readings arrive at regular 5-minute intervals
- Current readings displayed on the page refresh every 1 minute to show the latest available data
- Historical sensor data is retained indefinitely with smart downsampling: full granularity (5-minute intervals) for the most recent 15 days, then automatically downsampled to 30-minute intervals for older data to optimize storage while preserving long-term trends
- The page is part of an authenticated user session (greenhouse operator is logged in)
- Standard web accessibility guidelines (WCAG 2.1 Level AA) should be followed for professional appearance
- Temperature is measured and displayed in Celsius (standard for European greenhouse operations)
- Humidity is displayed as relative humidity percentage (0-100%)
- Soil moisture is displayed as percentage (0-100%) or volumetric water content
- Tank level uses the measurement unit most appropriate for the specific sensor (cm, liters, percentage)

## Out of Scope *(mandatory)*

- Configuration or management of sensors (handled by existing device/sensor management features; this page may guide users to those features via onboarding wizard but does not implement configuration itself)
- Alerting or notifications when values exceed thresholds (separate automation feature)
- Export of data to external formats (CSV, Excel, etc.)
- Comparison with external weather data or benchmarks
- Automated recommendations or AI-driven insights
- Manual data entry or correction of sensor readings
- Control of actuators (lights, pumps, fans) from this page
- Multi-greenhouse management or comparison between different greenhouse environments
- Predictive analytics or forecasting future conditions
- Integration with third-party greenhouse management systems
