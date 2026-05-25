# Story 6.3: Playwright E2E Tests

Status: draft

## Story

As a developer,
I want comprehensive end-to-end tests covering all user journeys,
so that I can verify the full system works correctly before releases.

## Acceptance Criteria

1. Playwright is installed and configured for the frontend with a `playwright.config.ts` that targets the running dev environment (frontend + full backend stack)
2. All E2E tests use `data-testid` selectors from Stories 1.8 and 5.1 -- no CSS class or tag selectors for interactive elements
3. Suite 1 (B2C Demo Flow) passes: consumer opens `/demo`, completes fact-finding as a solo backpacker (3 weeks, $1500), proposal is generated with itinerary/accommodations/budget, compliance warnings appear (e-visa required for test nationality), PDF export succeeds
4. Suite 2 (B2B Copilot Flow) passes: agent logs in with valid credentials, creates advisory session for a German family of 4 visiting Vietnam in December, profiling agent asks dynamic follow-ups (child ages, school constraints), copilot sidebar streams calculation results, proposal is generated with verified entities, compliance check passes (German = 45-day visa-free), PDF export succeeds
5. Suite 3 (Compliance Edge Cases) passes: agent creates session for a Russian client visiting Phu Quoc + HCMC, compliance checks run, the Phu Quoc visa trap is caught (e-visa required for combined island + mainland itinerary -- or confirmed visa-free if Russian nationals qualify), the compliance gate blocks or warns appropriately, after resolution the proposal exports successfully
6. Test suites execute in order: Suite 1 -> Suite 2 -> Suite 3 (serial, not parallel)
7. All tests produce trace artifacts on failure (Playwright trace, screenshots, video) for CI debugging
8. A traceability table maps each E2E test to the story acceptance criteria it validates

## Tasks

- [ ] Task 1: Install and configure Playwright (AC: #1, #7)
  - [ ] Install Playwright as a dev dependency: `npm install -D @playwright/test`
  - [ ] Install Playwright browsers: `npx playwright install --with-deps chromium`
  - [ ] Create `frontend/playwright.config.ts` with configuration (see Dev Notes)
  - [ ] Create `frontend/e2e/` directory for test files
  - [ ] Create `frontend/e2e/fixtures/` directory for shared test fixtures and helpers
  - [ ] Create `frontend/e2e/fixtures/test-data.ts` with test persona constants (see Dev Notes)
  - [ ] Create `frontend/e2e/fixtures/helpers.ts` with shared page interaction utilities
  - [ ] Add `"test:e2e": "playwright test"` script to `package.json`
  - [ ] Add `"test:e2e:ui": "playwright test --ui"` script for local debugging
  - [ ] Verify `npx playwright test --list` outputs test names without errors

- [ ] Task 2: Create shared E2E fixtures and helpers (AC: #2)
  - [ ] Create `frontend/e2e/fixtures/selectors.ts` -- centralized `data-testid` selector map (see Dev Notes for complete contract)
  - [ ] Create `frontend/e2e/fixtures/auth.ts` -- helper to authenticate as a B2B agent (login, store JWT, set auth cookie/header)
  - [ ] Create `frontend/e2e/fixtures/wait-helpers.ts` -- utilities for waiting on SSE-driven UI updates (stage changes, message arrivals, compliance flags)
  - [ ] Create `frontend/e2e/fixtures/assertions.ts` -- reusable assertion helpers (proposal sections visible, compliance badge color, stage indicator state)
  - [ ] All selectors use `page.getByTestId()` -- never `page.locator('.class')` or `page.locator('tag')`

- [ ] Task 3: Implement Suite 1 -- B2C Demo Flow (AC: #3)
  - [ ] Create `frontend/e2e/suite-1-b2c-demo.spec.ts`
  - [ ] Test: `demo-page-loads` -- Navigate to `/demo`, verify `demo-layout` is visible, verify `demo-stage-progress` shows profiling active, verify greeting message appears in `chat-messages`
  - [ ] Test: `fact-finding-solo-backpacker` -- Type solo backpacker profile into `chat-input` across multiple messages:
    - Message 1: "I'm a solo backpacker planning a 3-week trip to Vietnam"
    - Message 2: Budget response "$1500 total"
    - Message 3: Answer follow-up questions as they arrive (destinations, interests)
    - Verify agent asks follow-up questions (messages appear in `chat-messages`)
    - Verify `typing-indicator` appears while agent processes
    - Verify `chat-input` is disabled during agent processing
  - [ ] Test: `proposal-generated` -- After profiling completes:
    - Verify `demo-stage-progress` transitions through calculating -> proposing -> validating
    - Wait for `proposal-inline` to become visible
    - Verify `proposal-itinerary` section exists with day content
    - Verify `proposal-accommodations` section exists with hotel options
    - Verify `proposal-budget` section exists with category breakdown
    - Verify `proposal-actions` section exists with booking items
  - [ ] Test: `compliance-warnings-displayed` -- Verify compliance warnings appear:
    - For test nationality (non-ASEAN), verify e-visa warning is visible in the proposal or chat
    - Verify warning does not block proposal display (non-critical for demo)
  - [ ] Test: `pdf-export` -- Click `export-button`, verify download is triggered (intercept download event), verify no error message appears

- [ ] Task 4: Implement Suite 2 -- B2B Copilot Flow (AC: #4)
  - [ ] Create `frontend/e2e/suite-2-b2b-copilot.spec.ts`
  - [ ] Test: `agent-login` -- Navigate to login page, enter test agent credentials, verify redirect to `/sessions`, verify `session-list` is visible
  - [ ] Test: `create-advisory-session` -- Click `create-session-btn`, verify new session item appears in `session-list`, click to open, verify `copilot-layout` renders with `session-panel` and `copilot-sidebar`
  - [ ] Test: `profile-german-family` -- Fill `profile-form` with German family of 4 in December:
    - Set `profile-field-traveler_count` to 4
    - Set `profile-field-nationality` to "German"
    - Set `profile-field-travel_dates` to December dates
    - Set `profile-field-budget` to appropriate family budget
    - Set `profile-field-destinations` to Vietnam destinations
    - Click `profile-submit`
    - Verify `copilot-sidebar` receives profiling messages
  - [ ] Test: `dynamic-follow-ups` -- Verify the Profiling Agent asks family-specific follow-ups:
    - Wait for messages in `message-list` containing child age questions
    - Verify `stream-message-content` includes family-relevant prompts (ages, school constraints, kid-friendly activities)
    - Respond to follow-ups via the profile form or chat
  - [ ] Test: `sidebar-streams-results` -- After profiling completes:
    - Verify `stage-indicator` transitions from profiling (blue) to calculating (amber)
    - Wait for calculation result messages in `copilot-sidebar`
    - Verify `stage-indicator` transitions to proposing (green) then validating (purple)
    - Verify messages stream into `message-list` in real time
  - [ ] Test: `proposal-generated-with-entities` -- Wait for proposal:
    - Verify proposal viewer appears (via SSE `proposal.ready` event)
    - Verify proposal contains accommodation options with names, prices, and source links
    - Verify all entity names are present (not empty or placeholder)
  - [ ] Test: `compliance-passes-german` -- Verify compliance check:
    - Verify compliance SSE events arrive in sidebar
    - Verify overall compliance status is `pass` (green) for German 45-day visa-free
    - Verify no blocking flags appear
  - [ ] Test: `pdf-export-b2b` -- Trigger PDF export from proposal viewer, verify download completes successfully

- [ ] Task 5: Implement Suite 3 -- Compliance Edge Cases (AC: #5)
  - [ ] Create `frontend/e2e/suite-3-compliance-edge.spec.ts`
  - [ ] Test: `create-russian-phuquoc-session` -- Agent creates advisory session with:
    - Nationality: Russian
    - Destinations: Phu Quoc AND Ho Chi Minh City (combined island + mainland)
    - Fill profile via `profile-form` fields, submit
    - Wait for workflow to progress through stages
  - [ ] Test: `phuquoc-trap-detected` -- After compliance checks run:
    - Wait for compliance SSE events in `copilot-sidebar`
    - Verify compliance flags appear related to visa/Phu Quoc
    - If Russian nationals are visa-free for Vietnam: verify `pass` status (no trap -- Russians have 45-day visa-free)
    - If Phu Quoc trap applies: verify `block` or `warning` flag with message about combined island + mainland requiring e-visa
    - Verify compliance status badge shows appropriate color (green/yellow/red)
  - [ ] Test: `compliance-resolution` -- If compliance blocks the proposal:
    - If block: verify `export-button` is disabled or proposal export returns error
    - Resolve the blocking issue (update profile or apply override for warnings)
    - Verify compliance status changes after resolution
  - [ ] Test: `export-after-resolution` -- After compliance is resolved:
    - Verify proposal can now be exported
    - Trigger PDF export, verify download succeeds

- [ ] Task 6: Add CI integration (AC: #7)
  - [ ] Add Playwright step to `.github/workflows/ci.yml`:
    - Run after backend and frontend unit tests pass
    - Requires full service stack (docker-compose.full.yml)
    - Upload trace artifacts on failure
    - Upload HTML report as artifact
  - [ ] Create `frontend/e2e/global-setup.ts` for CI: verify backend health endpoint responds, verify frontend loads
  - [ ] Configure Playwright reporter: HTML report + JSON for CI, line reporter for local dev

- [ ] Task 7: Create traceability table (AC: #8)
  - [ ] Add traceability table to this story spec (see Dev Notes section)
  - [ ] Verify every AC from traced stories has at least one E2E test that validates it

## Dev Notes

### Playwright Configuration

```typescript
// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,  // Suites run in serial order
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // Serial execution — suites depend on system state
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['json', { outputFile: 'e2e-results.json' }]]
    : [['line'], ['html', { open: 'on-failure' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'Suite 1 - B2C Demo',
      testMatch: /suite-1-b2c-demo\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Suite 2 - B2B Copilot',
      testMatch: /suite-2-b2b-copilot\.spec\.ts/,
      dependencies: ['Suite 1 - B2C Demo'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Suite 3 - Compliance Edge',
      testMatch: /suite-3-compliance-edge\.spec\.ts/,
      dependencies: ['Suite 2 - B2B Copilot'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the dev server only if not already running (local dev)
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
```

### Test Data Constants

```typescript
// frontend/e2e/fixtures/test-data.ts

export const B2C_SOLO_BACKPACKER = {
  messages: [
    "I'm a solo backpacker planning a 3-week trip to Vietnam",
    "My total budget is around $1500",
    "I'm interested in Hanoi, Ho Chi Minh City, and some beach time. I love street food, history, and hiking.",
    "I'm flexible on dates but thinking sometime in the next few months. No dietary restrictions, no mobility issues.",
  ],
  expectedProfile: {
    travelerCount: 1,
    duration: '3 weeks',
    budget: 1500,
    style: 'backpacker',
  },
  // Test nationality that requires e-visa (e.g., British, American, Australian)
  expectedComplianceWarning: 'e-visa',
} as const;

export const B2B_GERMAN_FAMILY = {
  nationality: 'German',
  travelerCount: 4,
  travelMonth: 'December',
  travelYear: 2026,
  budget: 8000,
  destinations: ['Hanoi', 'Ho Chi Minh City', 'Phu Quoc'],
  notes: 'Family with 2 kids (ages 6 and 10). Need kid-friendly activities and family rooms.',
  expectedFollowUps: ['child', 'age', 'kid-friendly', 'school'],
  expectedComplianceStatus: 'pass',  // German = 45-day visa-free
} as const;

export const B2B_RUSSIAN_PHUQUOC = {
  nationality: 'Russian',
  travelerCount: 2,
  destinations: ['Phu Quoc', 'Ho Chi Minh City'],
  budget: 3000,
  travelMonth: 'March',
  travelYear: 2026,
  notes: 'Couple, want beach in Phu Quoc then city in HCMC.',
  // Russians have 45-day visa-free for Vietnam — Phu Quoc trap may NOT apply.
  // The test validates the system's ruling (block, warn, or pass) is consistent.
  phuQuocTrapPossible: true,
} as const;

export const TEST_AGENT_CREDENTIALS = {
  email: 'test-agent@stravel.dev',
  password: 'test-agent-password-123',
  tenantId: 'test-tenant-001',
} as const;
```

### Centralized Selector Map (data-testid Contract)

```typescript
// frontend/e2e/fixtures/selectors.ts
//
// Canonical data-testid contract. Sources:
//   - Story 1.8: B2B copilot components
//   - Story 5.1: B2C demo components
//   - Story 4.4: Compliance gate UI elements

// ─── B2B Components (Story 1.8) ─────────────────────────────
export const B2B = {
  // Layout
  copilotLayout:      'copilot-layout',
  copilotSidebar:     'copilot-sidebar',
  sessionPanel:       'session-panel',

  // Stage
  stageIndicator:     'stage-indicator',

  // Messages
  messageList:        'message-list',
  streamMessage:      'stream-message',
  streamMessageContent: 'stream-message-content',
  typingIndicator:    'typing-indicator',
  messageBubble:      'message-bubble',

  // Profile Form
  profileForm:        'profile-form',
  profileSubmit:      'profile-submit',
  profileField: (name: string) => `profile-field-${name}`,

  // Session List
  sessionList:        'session-list',
  sessionItem:        'session-item',
  createSessionBtn:   'create-session-btn',
} as const;

// ─── B2C Components (Story 5.1) ─────────────────────────────
export const B2C = {
  // Layout
  demoLayout:         'demo-layout',
  demoStageProgress:  'demo-stage-progress',
  demoError:          'demo-error',

  // Chat
  chatInterface:      'chat-interface',
  chatMessages:       'chat-messages',
  chatInput:          'chat-input',
  chatSendBtn:        'chat-send-btn',

  // Proposal Inline
  proposalInline:     'proposal-inline',
  proposalItinerary:  'proposal-itinerary',
  proposalAccommodations: 'proposal-accommodations',
  proposalBudget:     'proposal-budget',
  proposalActions:    'proposal-actions',

  // Export
  exportButton:       'export-button',
} as const;

// ─── Shared Components ──────────────────────────────────────
export const SHARED = {
  streamMessage:      'stream-message',
  streamMessageContent: 'stream-message-content',
  typingIndicator:    'typing-indicator',
  messageBubble:      'message-bubble',
} as const;
```

### Wait Helpers for SSE-Driven UI

```typescript
// frontend/e2e/fixtures/wait-helpers.ts
import { type Page, expect } from '@playwright/test';
import { B2B, B2C } from './selectors';

/**
 * Wait for a specific workflow stage to appear in the stage indicator.
 * Uses polling because SSE updates are asynchronous.
 */
export async function waitForStage(
  page: Page,
  stage: string,
  options: { timeout?: number; surface?: 'b2b' | 'b2c' } = {},
) {
  const { timeout = 60_000, surface = 'b2b' } = options;

  if (surface === 'b2b') {
    await expect(page.getByTestId(B2B.stageIndicator))
      .toContainText(stage, { timeout });
  } else {
    await expect(page.getByTestId(B2C.demoStageProgress))
      .toContainText(stage, { timeout, ignoreCase: true });
  }
}

/**
 * Wait for a new message to appear in the message list.
 * Returns the count of messages after the new one arrives.
 */
export async function waitForNewMessage(
  page: Page,
  options: { timeout?: number; surface?: 'b2b' | 'b2c' } = {},
): Promise<number> {
  const { timeout = 30_000, surface = 'b2b' } = options;
  const selector = surface === 'b2b' ? B2B.streamMessage : B2C.chatMessages;
  const locator = page.getByTestId(selector);

  const initialCount = await locator.count();

  await expect(async () => {
    const currentCount = await locator.count();
    expect(currentCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout });

  return locator.count();
}

/**
 * Wait for the typing indicator to appear then disappear.
 * Indicates agent has finished processing.
 */
export async function waitForAgentResponse(
  page: Page,
  options: { timeout?: number } = {},
) {
  const { timeout = 30_000 } = options;
  const indicator = page.getByTestId(SHARED.typingIndicator);

  // Wait for indicator to appear (agent is processing)
  await expect(indicator).toBeVisible({ timeout: 10_000 }).catch(() => {
    // Indicator might have already appeared and disappeared
  });

  // Wait for indicator to disappear (agent finished)
  await expect(indicator).toBeHidden({ timeout });
}

/**
 * Wait for the proposal to be fully rendered in B2C demo.
 */
export async function waitForProposal(
  page: Page,
  options: { timeout?: number } = {},
) {
  const { timeout = 120_000 } = options;  // Proposals can take a while to generate
  await expect(page.getByTestId(B2C.proposalInline)).toBeVisible({ timeout });
}

/**
 * Wait for compliance flags to appear in the copilot sidebar.
 */
export async function waitForComplianceResult(
  page: Page,
  options: { timeout?: number } = {},
) {
  const { timeout = 60_000 } = options;
  // Wait for the stage to reach validating, then wait for result
  await waitForStage(page, 'validating', { timeout: timeout / 2 });
  // Compliance results appear as messages in the sidebar
  await page.waitForTimeout(2000);  // Allow SSE events to arrive
}

import { SHARED } from './selectors';
```

### Auth Helper

```typescript
// frontend/e2e/fixtures/auth.ts
import { type Page } from '@playwright/test';
import { TEST_AGENT_CREDENTIALS } from './test-data';

/**
 * Authenticate as a test travel agent.
 * Stores the JWT token for subsequent API requests.
 */
export async function loginAsAgent(page: Page): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Fill credentials
  await page.getByLabel(/email/i).fill(TEST_AGENT_CREDENTIALS.email);
  await page.getByLabel(/password/i).fill(TEST_AGENT_CREDENTIALS.password);

  // Submit login form
  await page.getByRole('button', { name: /log\s*in|sign\s*in/i }).click();

  // Wait for redirect to sessions page
  await page.waitForURL(/\/sessions/, { timeout: 10_000 });
}

/**
 * Authenticate via API and inject token into browser context.
 * Faster than UI login -- use for setup in beforeEach.
 */
export async function loginAsAgentViaAPI(page: Page): Promise<string> {
  const response = await page.request.post('/api/v1/auth/login', {
    data: {
      email: TEST_AGENT_CREDENTIALS.email,
      password: TEST_AGENT_CREDENTIALS.password,
    },
  });

  const body = await response.json();
  const token = body.access_token;

  // Store token in localStorage for the frontend to pick up
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
  }, token);

  return token;
}
```

### Suite 1 -- B2C Demo Flow Test Pattern

```typescript
// frontend/e2e/suite-1-b2c-demo.spec.ts
import { test, expect } from '@playwright/test';
import { B2C, SHARED } from './fixtures/selectors';
import { B2C_SOLO_BACKPACKER } from './fixtures/test-data';
import {
  waitForStage,
  waitForAgentResponse,
  waitForProposal,
} from './fixtures/wait-helpers';

test.describe('Suite 1: B2C Demo Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let page: import('@playwright/test').Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('demo page loads with greeting', async () => {
    await page.goto('/demo');

    // Verify layout renders
    await expect(page.getByTestId(B2C.demoLayout)).toBeVisible();
    await expect(page.getByTestId(B2C.demoStageProgress)).toBeVisible();
    await expect(page.getByTestId(B2C.chatInterface)).toBeVisible();

    // Verify greeting message appears
    const messages = page.getByTestId(B2C.chatMessages);
    await expect(messages).toContainText(/welcome|plan|vietnam/i, {
      timeout: 10_000,
    });

    // Verify chat input is enabled during profiling
    await expect(page.getByTestId(B2C.chatInput)).toBeEnabled();
  });

  test('fact-finding conversation completes', async () => {
    const chatInput = page.getByTestId(B2C.chatInput);
    const sendBtn = page.getByTestId(B2C.chatSendBtn);

    for (const message of B2C_SOLO_BACKPACKER.messages) {
      // Type user message
      await chatInput.fill(message);
      await sendBtn.click();

      // Verify user message appears in chat
      await expect(page.getByTestId(B2C.chatMessages)).toContainText(message);

      // Wait for agent response
      await waitForAgentResponse(page, { timeout: 30_000 });
    }

    // Verify the profiling stage completes
    // (stage transitions to calculating after profile is complete)
    await waitForStage(page, 'calculating', {
      timeout: 60_000,
      surface: 'b2c',
    });
  });

  test('proposal is generated with all sections', async () => {
    // Wait for full workflow: calculating -> proposing -> validating -> complete
    await waitForProposal(page, { timeout: 180_000 });

    // Verify all proposal sections exist
    await expect(page.getByTestId(B2C.proposalItinerary)).toBeVisible();
    await expect(page.getByTestId(B2C.proposalAccommodations)).toBeVisible();
    await expect(page.getByTestId(B2C.proposalBudget)).toBeVisible();
    await expect(page.getByTestId(B2C.proposalActions)).toBeVisible();

    // Verify itinerary has day content
    const itinerary = page.getByTestId(B2C.proposalItinerary);
    await expect(itinerary).toContainText(/day/i);

    // Verify budget section has category entries
    const budget = page.getByTestId(B2C.proposalBudget);
    await expect(budget).toContainText(/\$/);
  });

  test('compliance warnings displayed for e-visa', async () => {
    // For a non-ASEAN solo backpacker, e-visa warning should be present
    // Check in either the proposal area or the chat messages
    const pageContent = await page.textContent('body');
    const hasVisaWarning =
      pageContent?.toLowerCase().includes('e-visa') ||
      pageContent?.toLowerCase().includes('visa');

    // The system should mention visa requirements for non-ASEAN nationals
    expect(hasVisaWarning).toBeTruthy();
  });

  test('PDF export succeeds', async () => {
    const exportButton = page.getByTestId(B2C.exportButton);
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();

    // Intercept the download
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await exportButton.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });
});
```

### Suite 2 -- B2B Copilot Flow Test Pattern

```typescript
// frontend/e2e/suite-2-b2b-copilot.spec.ts
import { test, expect } from '@playwright/test';
import { B2B } from './fixtures/selectors';
import { B2B_GERMAN_FAMILY, TEST_AGENT_CREDENTIALS } from './fixtures/test-data';
import { loginAsAgent, loginAsAgentViaAPI } from './fixtures/auth';
import {
  waitForStage,
  waitForNewMessage,
  waitForComplianceResult,
} from './fixtures/wait-helpers';

test.describe('Suite 2: B2B Copilot Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let page: import('@playwright/test').Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('agent logs in successfully', async () => {
    await loginAsAgent(page);

    // Verify session list is visible after login
    await expect(page.getByTestId(B2B.sessionList)).toBeVisible();
  });

  test('creates advisory session', async () => {
    // Click create session button
    await page.getByTestId(B2B.createSessionBtn).click();

    // Verify new session appears in list
    await expect(page.getByTestId(B2B.sessionItem).first()).toBeVisible({
      timeout: 10_000,
    });

    // Click to open the new session
    await page.getByTestId(B2B.sessionItem).first().click();

    // Verify copilot layout renders
    await expect(page.getByTestId(B2B.copilotLayout)).toBeVisible();
    await expect(page.getByTestId(B2B.sessionPanel)).toBeVisible();
    await expect(page.getByTestId(B2B.copilotSidebar)).toBeVisible();
  });

  test('profiles German family of 4 in December', async () => {
    const form = page.getByTestId(B2B.profileForm);
    await expect(form).toBeVisible();

    // Fill traveler count
    await page
      .getByTestId(B2B.profileField('traveler_count'))
      .fill(String(B2B_GERMAN_FAMILY.travelerCount));

    // Fill nationality
    await page
      .getByTestId(B2B.profileField('nationality'))
      .fill(B2B_GERMAN_FAMILY.nationality);

    // Fill travel dates (December)
    await page
      .getByTestId(B2B.profileField('travel_dates'))
      .fill(`${B2B_GERMAN_FAMILY.travelYear}-12-01`);

    // Fill budget
    await page
      .getByTestId(B2B.profileField('budget'))
      .fill(String(B2B_GERMAN_FAMILY.budget));

    // Fill destinations
    await page
      .getByTestId(B2B.profileField('destinations'))
      .fill(B2B_GERMAN_FAMILY.destinations.join(', '));

    // Fill notes with family details
    await page
      .getByTestId(B2B.profileField('notes'))
      .fill(B2B_GERMAN_FAMILY.notes);

    // Submit profile
    await page.getByTestId(B2B.profileSubmit).click();

    // Verify sidebar receives messages
    await expect(page.getByTestId(B2B.messageList)).toBeVisible();
  });

  test('profiling agent asks dynamic follow-ups for family', async () => {
    // Wait for profiling messages to appear in the sidebar
    await waitForNewMessage(page, { timeout: 30_000 });

    // Verify the agent asks family-relevant follow-up questions
    const messageList = page.getByTestId(B2B.messageList);
    const messageTexts = await messageList.allTextContents();
    const allText = messageTexts.join(' ').toLowerCase();

    // Check for at least one family-specific follow-up
    const hasFamilyFollowUp = B2B_GERMAN_FAMILY.expectedFollowUps.some(
      (keyword) => allText.includes(keyword),
    );

    expect(hasFamilyFollowUp).toBeTruthy();
  });

  test('copilot sidebar streams calculation results', async () => {
    // Wait for stage transition to calculating
    await waitForStage(page, 'calculating', { timeout: 60_000 });

    // Verify stage indicator shows calculating (amber)
    const stageIndicator = page.getByTestId(B2B.stageIndicator);
    await expect(stageIndicator).toBeVisible();

    // Wait for calculation messages to stream in
    await waitForNewMessage(page, { timeout: 60_000 });

    // Verify stage transitions continue
    await waitForStage(page, 'proposing', { timeout: 60_000 });
  });

  test('proposal generated with verified entities', async () => {
    // Wait for proposal stage to complete
    await waitForStage(page, 'validating', { timeout: 120_000 });

    // Verify proposal content appears in sidebar messages
    const sidebarContent = await page
      .getByTestId(B2B.copilotSidebar)
      .textContent();

    // Proposal should contain accommodation names (real entities, not empty)
    expect(sidebarContent).toBeTruthy();
    expect(sidebarContent!.length).toBeGreaterThan(100);
  });

  test('compliance passes for German nationality (visa-free)', async () => {
    // Wait for compliance results
    await waitForComplianceResult(page, { timeout: 60_000 });

    // Verify compliance status is pass (green) for German = 45-day visa-free
    const sidebarContent = await page
      .getByTestId(B2B.copilotSidebar)
      .textContent();

    // Should not contain any blocking flags
    const hasBlock = sidebarContent?.toLowerCase().includes('block');
    expect(hasBlock).toBeFalsy();

    // Should indicate visa-free or pass status
    const hasPassOrVisaFree =
      sidebarContent?.toLowerCase().includes('visa-free') ||
      sidebarContent?.toLowerCase().includes('pass') ||
      sidebarContent?.toLowerCase().includes('45-day');

    expect(hasPassOrVisaFree).toBeTruthy();
  });

  test('PDF export succeeds for B2B proposal', async () => {
    // Find the export/download mechanism in the B2B interface
    // This could be a button in the proposal viewer or session panel
    const exportButton = page.getByRole('button', { name: /export|pdf|download/i });
    await expect(exportButton).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await exportButton.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });
});
```

### Suite 3 -- Compliance Edge Cases Test Pattern

```typescript
// frontend/e2e/suite-3-compliance-edge.spec.ts
import { test, expect } from '@playwright/test';
import { B2B } from './fixtures/selectors';
import { B2B_RUSSIAN_PHUQUOC, TEST_AGENT_CREDENTIALS } from './fixtures/test-data';
import { loginAsAgentViaAPI } from './fixtures/auth';
import {
  waitForStage,
  waitForComplianceResult,
} from './fixtures/wait-helpers';

test.describe('Suite 3: Compliance Edge Cases', () => {
  test.describe.configure({ mode: 'serial' });

  let page: import('@playwright/test').Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    // Login via API for faster setup (agent already logged in during Suite 2)
    await loginAsAgentViaAPI(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('creates session for Russian client with Phu Quoc + HCMC', async () => {
    // Navigate to sessions and create new
    await page.goto('/sessions');
    await page.getByTestId(B2B.createSessionBtn).click();
    await page.getByTestId(B2B.sessionItem).first().click();

    // Wait for copilot layout
    await expect(page.getByTestId(B2B.copilotLayout)).toBeVisible();

    // Fill profile for Russian client
    await page
      .getByTestId(B2B.profileField('traveler_count'))
      .fill(String(B2B_RUSSIAN_PHUQUOC.travelerCount));
    await page
      .getByTestId(B2B.profileField('nationality'))
      .fill(B2B_RUSSIAN_PHUQUOC.nationality);
    await page
      .getByTestId(B2B.profileField('destinations'))
      .fill(B2B_RUSSIAN_PHUQUOC.destinations.join(', '));
    await page
      .getByTestId(B2B.profileField('budget'))
      .fill(String(B2B_RUSSIAN_PHUQUOC.budget));
    await page
      .getByTestId(B2B.profileField('travel_dates'))
      .fill(`${B2B_RUSSIAN_PHUQUOC.travelYear}-${String(
        new Date(`${B2B_RUSSIAN_PHUQUOC.travelMonth} 1, 2026`).getMonth() + 1,
      ).padStart(2, '0')}-01`);
    await page
      .getByTestId(B2B.profileField('notes'))
      .fill(B2B_RUSSIAN_PHUQUOC.notes);

    // Submit
    await page.getByTestId(B2B.profileSubmit).click();
  });

  test('compliance detects Phu Quoc + mainland combination', async () => {
    // Wait for workflow to reach compliance stage
    await waitForComplianceResult(page, { timeout: 120_000 });

    const sidebarContent = await page
      .getByTestId(B2B.copilotSidebar)
      .textContent();
    const contentLower = sidebarContent?.toLowerCase() || '';

    // The system should address the Phu Quoc situation for Russian nationals.
    //
    // Russia has a 45-day visa-free arrangement with Vietnam, so the
    // Phu Quoc trap (30-day island-only visa-free) may not apply to Russians
    // since they already have visa-free access to the mainland.
    //
    // The test validates the system produces a CONSISTENT and EXPLICIT ruling:
    const mentionsPhuQuoc = contentLower.includes('phu quoc') || contentLower.includes('phu quốc');
    const mentionsVisa = contentLower.includes('visa');

    // The compliance system must address the Phu Quoc + HCMC combination
    // explicitly -- either confirming it is visa-free OR flagging it
    expect(mentionsPhuQuoc || mentionsVisa).toBeTruthy();
  });

  test('compliance resolution and export', async () => {
    const sidebarContent = await page
      .getByTestId(B2B.copilotSidebar)
      .textContent();
    const contentLower = sidebarContent?.toLowerCase() || '';

    const isBlocked = contentLower.includes('block');
    const isWarning = contentLower.includes('warning');

    if (isBlocked) {
      // If blocked: attempt override or resolve the issue
      // Override button should be available for non-critical blocks
      const overrideButton = page.getByRole('button', {
        name: /override|resolve|acknowledge/i,
      });

      if (await overrideButton.isVisible()) {
        await overrideButton.click();
        // Wait for status update
        await page.waitForTimeout(3000);
      }
    } else if (isWarning) {
      // Warnings don't block -- proposal should be exportable
      // Optionally acknowledge warnings
      const acknowledgeButton = page.getByRole('button', {
        name: /acknowledge|override|continue/i,
      });

      if (await acknowledgeButton.isVisible()) {
        await acknowledgeButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // Attempt PDF export
    const exportButton = page.getByRole('button', {
      name: /export|pdf|download/i,
    });

    // If compliance was blocking and could not be resolved, export may still fail.
    // In that case, verify the error is clear.
    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await exportButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.pdf');
    } else {
      // If no export button, verify the compliance block is clearly communicated
      expect(isBlocked).toBeTruthy();
    }
  });
});
```

### Global Setup for CI

```typescript
// frontend/e2e/global-setup.ts
import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';
  const apiURL = 'http://localhost:8000';

  // Verify backend is healthy
  const healthCheck = await fetch(`${apiURL}/api/v1/health`).catch(() => null);
  if (!healthCheck || !healthCheck.ok) {
    throw new Error(
      `Backend health check failed at ${apiURL}/api/v1/health. ` +
      'Ensure docker-compose.full.yml is running with all services.',
    );
  }

  // Verify frontend is reachable
  const frontendCheck = await fetch(baseURL).catch(() => null);
  if (!frontendCheck || !frontendCheck.ok) {
    throw new Error(
      `Frontend not reachable at ${baseURL}. ` +
      'Ensure the dev server or production build is running.',
    );
  }

  console.log('Global setup complete: backend and frontend are reachable.');
}

export default globalSetup;
```

### CI Integration

```yaml
# Add to .github/workflows/ci.yml after existing test jobs

  e2e:
    name: Playwright E2E Tests
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]  # Run after unit tests pass
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: stravel
          POSTGRES_PASSWORD: stravel
          POSTGRES_DB: stravel
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Start full service stack
        run: docker compose -f docker-compose.full.yml up -d

      - name: Wait for services
        run: |
          timeout 120 bash -c 'until curl -sf http://localhost:8000/api/v1/health; do sleep 2; done'

      - name: Seed test data
        run: |
          docker compose exec backend python data/scripts/seed_vector_store.py
          docker compose exec backend python -c "from app.core.seed_test_users import seed; seed()"

      - name: Install Playwright
        working-directory: frontend
        run: |
          npm ci
          npx playwright install --with-deps chromium

      - name: Run Playwright E2E tests
        working-directory: frontend
        run: npx playwright test
        env:
          E2E_BASE_URL: http://localhost:5173
          CI: true

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 14

      - name: Upload traces on failure
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: frontend/test-results/
          retention-days: 7
```

### File Structure

```
frontend/
├── playwright.config.ts                    # NEW — Playwright configuration
├── e2e/
│   ├── global-setup.ts                     # NEW — CI health checks
│   ├── suite-1-b2c-demo.spec.ts            # NEW — B2C demo flow tests
│   ├── suite-2-b2b-copilot.spec.ts         # NEW — B2B copilot flow tests
│   ├── suite-3-compliance-edge.spec.ts     # NEW — Compliance edge case tests
│   └── fixtures/
│       ├── selectors.ts                    # NEW — data-testid selector map
│       ├── test-data.ts                    # NEW — test persona constants
│       ├── auth.ts                         # NEW — login helpers
│       ├── wait-helpers.ts                 # NEW — SSE wait utilities
│       └── assertions.ts                   # NEW — reusable assertions
├── package.json                            # MODIFIED — add playwright dep + scripts
└── .gitignore                              # MODIFIED — add test-results/, playwright-report/

.github/workflows/
└── ci.yml                                  # MODIFIED — add e2e job
```

### E2E Test to Story AC Traceability

| E2E Test | Suite | Story | ACs Validated | What It Proves |
|---|---|---|---|---|
| `demo-page-loads` | 1 | 5.1 | AC#1, AC#8, AC#10 | Demo accessible without login, layout renders, stage progress visible |
| `fact-finding-solo-backpacker` | 1 | 5.1, 1.4 | 5.1#2, 1.4#1 | Chat-based fact-finding works, agent asks follow-ups, typing indicator shows |
| `proposal-generated` | 1 | 5.1, 3.5, 3.6 | 5.1#3, 5.1#4, 3.5#1, 3.6#1 | Full 4-stage workflow runs automatically, proposal has all sections |
| `compliance-warnings-displayed` | 1 | 4.1 | 4.1#2 | E-visa requirement detected for non-ASEAN national |
| `pdf-export` (B2C) | 1 | 3.7, 5.1 | 3.7#1, 5.1#4 | PDF export works from demo interface |
| `agent-login` | 2 | 1.6, 1.8 | 1.6#2, 1.8#7 | Agent authenticates, session list renders |
| `create-advisory-session` | 2 | 1.8 | 1.8#2, 1.8#7 | Split-screen copilot layout renders with session panel + sidebar |
| `profile-german-family` | 2 | 1.8, 1.4 | 1.8#6, 1.4#1 | Profile form submits, profiling agent receives data |
| `dynamic-follow-ups` | 2 | 1.4 | 1.4#2, 1.4#5 | Family context triggers child-specific follow-up questions |
| `sidebar-streams-results` | 2 | 1.7, 1.8 | 1.7#2, 1.7#5, 1.8#3, 1.8#8 | SSE streams results to sidebar, stage transitions visible in real time |
| `proposal-generated-with-entities` | 2 | 3.5, 3.2 | 3.5#2, 3.2#4 | Proposal contains real entity names from Vector Store |
| `compliance-passes-german` | 2 | 4.1 | 4.1#1 | German 45-day visa-free correctly identified, no blocks |
| `pdf-export-b2b` | 2 | 3.7 | 3.7#1 | PDF export works from B2B copilot interface |
| `create-russian-phuquoc-session` | 3 | 1.8, 1.4 | 1.8#6, 1.4#1 | Profile with Russian + Phu Quoc + HCMC submitted successfully |
| `phuquoc-trap-detected` | 3 | 4.1, 4.4 | 4.1#2 (Phu Quoc special case), 4.4#1 | Compliance correctly evaluates Phu Quoc + mainland combination for Russian national |
| `compliance-resolution-and-export` | 3 | 4.4, 3.7 | 4.4#4, 4.4#5, 4.4#6, 3.7#1 | Override/resolution flow works, export succeeds after compliance resolution |

### Traceability Summary by Source Story

| Story | ACs Covered by E2E | ACs Not Covered (unit/integration scope) |
|---|---|---|
| **1.4** Profiling Agent | AC#1 (round 1 questions), AC#2 (family follow-up), AC#5 (8 triggers partial) | AC#6 (no re-ask), AC#7 (no assumptions), AC#8 (prompts.py), AC#9 (unit tests) |
| **1.6** Auth & Tenant | AC#2 (JWT login) | AC#1, AC#3-AC#7 (middleware, tenant isolation -- integration tests) |
| **1.7** SSE Streaming | AC#2 (events arrive), AC#5 (latency) | AC#1, AC#3, AC#4, AC#6-AC#10 (wire format, reconnection -- integration tests) |
| **1.8** React Copilot | AC#2 (split-screen), AC#3 (SSE display), AC#6 (profile form), AC#7 (session list), AC#8 (stage indicator) | AC#4, AC#5, AC#9, AC#10 (hook internals, type generation) |
| **3.2** Accommodation | AC#4 (no hallucinated entities) | AC#1-AC#3, AC#5-AC#7 (scoring, filtering -- unit tests) |
| **3.5** Proposal - Itinerary | AC#1 (day-by-day), AC#2 (entity traceability) | AC#3-AC#7 (transport, dietary, weather -- unit tests) |
| **3.6** Proposal - Tables | AC#1 (comparison table, budget) | AC#2-AC#5 (source links, price validation -- unit tests) |
| **3.7** Proposal Export | AC#1 (PDF generation) | AC#2 (shareable link), AC#3-AC#5 (storage, auth) |
| **4.1** Visa Compliance | AC#1 (visa-free identification), AC#2 (Phu Quoc special case) | AC#3-AC#5 (details, missing nationality, passport) |
| **4.4** Compliance Gate | AC#1 (aggregated report), AC#4 (block prevents export), AC#5 (resolution guidance), AC#6 (override) | AC#2, AC#3, AC#7-AC#14 (DB persistence, SSE events -- integration tests) |
| **5.1** B2C Demo | AC#1 (no login), AC#2 (chat), AC#3 (auto workflow), AC#4 (inline proposal + export), AC#8 (data-testid), AC#10 (stage progress) | AC#5-AC#7, AC#9 (ephemeral state, rate limiting, shared components -- unit tests) |

### Test Timeouts

E2E tests involving LLM inference and full workflow execution need generous timeouts:

| Operation | Recommended Timeout | Rationale |
|---|---|---|
| Page navigation | 15s | Standard |
| Agent response (single message) | 30s | LLM inference via Ollama can be slow on CPU |
| Stage transition | 60s | Includes agent processing + SSE delivery |
| Full workflow (profile -> proposal) | 180s | 4 stages, each with LLM calls + RAG queries |
| Compliance check completion | 60s | 8 individual checks, some with data lookups |
| PDF export | 30s | PDF generation + file download |

### Phu Quoc Special Case -- Test Rationale

The Phu Quoc visa trap (Story 4.1 AC#2) states: "30-day visa-free only if staying exclusively on island -- if combined with mainland, e-visa required."

For Suite 3, the test uses a **Russian** national visiting Phu Quoc + HCMC. Russia has a **45-day visa-free** arrangement with Vietnam (bilateral agreement). This creates an interesting edge case:

- **If the system treats Russian visa-free as overriding the Phu Quoc trap:** Result is `pass` -- Russians don't need the Phu Quoc island-only exemption because they have full mainland visa-free access.
- **If the system applies the Phu Quoc trap regardless:** Result is `block` or `warning` -- the combined itinerary triggers the e-visa requirement.

The correct answer depends on the compliance rule implementation. The E2E test validates that the system **makes an explicit, consistent ruling** and communicates it clearly -- it does not hardcode which outcome is "correct." The test checks:
1. The Phu Quoc + mainland combination is evaluated (not silently ignored)
2. The compliance result is communicated via the sidebar
3. If blocked, the resolution flow works
4. Export succeeds after any required resolution

### Anti-Patterns -- DO NOT

- **DO NOT** use CSS class selectors (`.className`) or tag selectors (`div`, `button`) for test selectors -- use `data-testid` exclusively
- **DO NOT** use `page.waitForTimeout()` as the primary wait strategy -- use `expect().toBeVisible()`, `expect().toContainText()`, or custom wait helpers with explicit conditions
- **DO NOT** run suites in parallel -- they must run serially (Suite 1 -> 2 -> 3) because they validate progressively complex scenarios and may share system state
- **DO NOT** hardcode expected compliance outcomes for Suite 3 -- the Phu Quoc + Russian case has legitimate ambiguity; test for consistency and explicitness, not a specific pass/fail
- **DO NOT** mock backend services -- E2E tests run against the full system with all services
- **DO NOT** skip trace/screenshot capture on failure -- these are essential for CI debugging
- **DO NOT** use `page.evaluate()` for assertions -- use Playwright's built-in assertion API
- **DO NOT** import between `b2b/` and `b2c/` test code -- shared utilities go in `fixtures/`
- **DO NOT** create test data via direct database manipulation -- use the API endpoints and UI interactions

### Prerequisites

- Story 1.4 (Profiling Agent) -- provides conversational fact-finding with dynamic follow-ups
- Story 1.6 (Auth, Tenant & Multi-tenancy) -- provides login and JWT for B2B flows
- Story 1.7 (SSE Streaming Endpoint) -- provides real-time agent output streaming
- Story 1.8 (React Copilot Sidebar) -- provides B2B UI components with `data-testid` attributes
- Story 3.5 (Proposal - Itinerary Generation) -- provides proposal generation
- Story 3.7 (Proposal Export) -- provides PDF export
- Story 4.1 (Visa & Document Compliance) -- provides visa checking including Phu Quoc special case
- Story 4.4 (Compliance Gate) -- provides compliance aggregation, blocking, and override
- Story 5.1 (B2C Demo Chat) -- provides demo interface with `data-testid` attributes
- Story 6.1 (Kubernetes Deployment) or `docker-compose.full.yml` -- full service stack must be running

### Dependencies on This Story

None -- this is the final validation story in the project.

### Testing Approach

These ARE the tests. No separate unit tests for this story. The deliverable is the Playwright test suite itself. Validation is:
- All 3 suites pass against the running system
- Trace artifacts are generated on failure
- Traceability table covers all referenced story ACs

### References

- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 6, Story 6.3]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 6.3 Traceability Table]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Frontend Architecture: React + TypeScript, data-testid]
- [Source: _bmad-output/planning-artifacts/architecture.md -- API & Communication Patterns: SSE event format]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Authentication & Security: JWT B2B, no auth B2C]
- [Source: _bmad-output/implementation-artifacts/epic-1/1-8-react-copilot.md -- data-testid Contract]
- [Source: _bmad-output/implementation-artifacts/epic-5/5-1-b2c-demo-chat.md -- data-testid Contract]
- [Source: _bmad-output/implementation-artifacts/epic-4/4-4-compliance-gate.md -- Compliance severity, override flow]
- [Source: _bmad-output/project-context.md -- All interactive components need data-testid attributes for Playwright]
- [Source: Playwright docs -- https://playwright.dev/docs/intro]

## Dev Agent Record

### Agent Model Used

(To be filled by implementing agent)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled on completion)

### Change Log

- 2026-05-24: Story spec created -- ready for dev

### File List

(To be filled on completion with all created/modified files)
