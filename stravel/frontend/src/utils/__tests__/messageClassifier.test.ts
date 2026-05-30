import { describe, it, expect } from 'vitest';
import { classifyMessage, classifyBuildTripIntent } from '../messageClassifier';

describe('classifyMessage — ambiguous messages', () => {
  it('"I need a trip" → ambiguous', () => {
    expect(classifyMessage('I need a trip')).toBe('ambiguous');
  });

  it('"Let\'s plan something" → ambiguous', () => {
    expect(classifyMessage("Let's plan something")).toBe('ambiguous');
  });

  it('empty string → ambiguous', () => {
    expect(classifyMessage('')).toBe('ambiguous');
  });

  it('"I want a relaxing holiday" → ambiguous', () => {
    expect(classifyMessage('I want a relaxing holiday')).toBe('ambiguous');
  });

  it('"surprise me" alone → ambiguous', () => {
    expect(classifyMessage('surprise me')).toBe('ambiguous');
  });
});

describe('classifyMessage — specific: destination names', () => {
  it('"I want to go to Hanoi" → specific', () => {
    expect(classifyMessage('I want to go to Hanoi')).toBe('specific');
  });

  it('"Beach trip to Phu Quoc" → specific', () => {
    expect(classifyMessage('Beach trip to Phu Quoc')).toBe('specific');
  });

  it('"Flying to Da Nang" → specific', () => {
    expect(classifyMessage('Flying to Da Nang')).toBe('specific');
  });

  it('case insensitive: "HANOI trip" → specific', () => {
    expect(classifyMessage('HANOI trip')).toBe('specific');
  });
});

describe('classifyMessage — specific: budget signals', () => {
  it('"Budget is $2000" → specific', () => {
    expect(classifyMessage('Budget is $2000')).toBe('specific');
  });

  it('"I have a budget of 5000 USD" → specific', () => {
    expect(classifyMessage('I have a budget of 5000 USD')).toBe('specific');
  });
});

describe('classifyMessage — specific: date signals', () => {
  it('"Going next month" → specific', () => {
    expect(classifyMessage('Going next month')).toBe('specific');
  });

  it('"I\'d like to travel in March" → specific', () => {
    expect(classifyMessage("I'd like to travel in March")).toBe('specific');
  });

  it('"This weekend getaway" → specific', () => {
    expect(classifyMessage('This weekend getaway')).toBe('specific');
  });
});

describe('classifyMessage — specific: destination verbs', () => {
  it('"I want to visit Vietnam" → specific', () => {
    expect(classifyMessage('I want to visit Vietnam')).toBe('specific');
  });

  it('"Planning to go somewhere warm" → specific', () => {
    expect(classifyMessage('Planning to go somewhere warm')).toBe('specific');
  });
});

describe('classifyBuildTripIntent — positive matches', () => {
  it('exact "build my trip" → true', () => {
    expect(classifyBuildTripIntent('build my trip')).toBe(true);
  });

  it('case-insensitive "BUILD MY TRIP" → true', () => {
    expect(classifyBuildTripIntent('BUILD MY TRIP')).toBe(true);
  });

  it('in a sentence "can you build my trip please" → true', () => {
    expect(classifyBuildTripIntent('can you build my trip please')).toBe(true);
  });

  it('"start my trip" → true', () => {
    expect(classifyBuildTripIntent('start my trip')).toBe(true);
  });

  it('"generate my trip" → true', () => {
    expect(classifyBuildTripIntent('generate my trip')).toBe(true);
  });

  it('"start now" → true', () => {
    expect(classifyBuildTripIntent('start now')).toBe(true);
  });

  it('"yes please" → true', () => {
    expect(classifyBuildTripIntent('yes please')).toBe(true);
  });
});

describe('classifyBuildTripIntent — negative cases', () => {
  it('"tell me about trips" → false', () => {
    expect(classifyBuildTripIntent('tell me about trips')).toBe(false);
  });

  it('"what is my budget" → false', () => {
    expect(classifyBuildTripIntent("what's my budget")).toBe(false);
  });

  it('empty string → false', () => {
    expect(classifyBuildTripIntent('')).toBe(false);
  });

  it('"I need a holiday" → false', () => {
    expect(classifyBuildTripIntent('I need a holiday')).toBe(false);
  });

  it('"go ahead with Paris" → false (pruned broad pattern)', () => {
    expect(classifyBuildTripIntent("I don't want to go ahead with Paris")).toBe(false);
  });

  it('"run it" → false (pruned broad pattern)', () => {
    expect(classifyBuildTripIntent('run it')).toBe(false);
  });
});
