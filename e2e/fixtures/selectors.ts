/**
 * Centralized data-testid selector map.
 * Source: Stories 1.8 (B2B) and 5.1 (B2C).
 */
export const S = {
  // Shared components
  streamMessage: '[data-testid="stream-message"]',
  typingIndicator: '[data-testid="typing-indicator"]',
  messageBubble: '[data-testid="message-bubble"]',
  complianceBadge: '[data-testid="compliance-badge"]',

  // B2B Copilot
  copilotLayout: '[data-testid="copilot-layout"]',
  sessionPanel: '[data-testid="session-panel"]',
  copilotSidebar: '[data-testid="copilot-sidebar"]',
  createSessionBtn: '[data-testid="create-session-btn"]',
  stageIndicator: '[data-testid="stage-indicator"]',

  // B2C Demo
  demoLayout: '[data-testid="demo-layout"]',
  demoTitle: '[data-testid="demo-title"]',
  stageProgress: '[data-testid="stage-progress"]',
  chatInterface: '[data-testid="chat-interface"]',
  chatInput: '[data-testid="chat-input"]',
  chatSend: '[data-testid="chat-send"]',
  chatMessages: '[data-testid="chat-messages"]',
  proposalInline: '[data-testid="proposal-inline"]',
  exportButton: '[data-testid="export-button"]',
} as const;

export const TEST_DATA = {
  backpacker: {
    message1: "I'm a solo backpacker planning 3 weeks in Vietnam on a $1500 budget",
    message2: "I'm interested in food, culture, and trekking. Flexible on dates.",
    nationality: "AU",
  },
  germanFamily: {
    message1: "We're a family of 4 (kids age 6 and 10) visiting Vietnam for 10 days in December",
    message2: "Budget is $5000. Interested in culture, food, and kid-friendly activities.",
    nationality: "DE",
  },
  russianCouple: {
    message1: "We're a couple visiting Phu Quoc and Ho Chi Minh City for 2 weeks",
    nationality: "RU",
  },
} as const;
