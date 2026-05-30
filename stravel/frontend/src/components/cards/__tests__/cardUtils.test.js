import { describe, it, expect } from 'vitest';
import { cardDisplayState } from '../cardUtils';
describe('cardDisplayState', () => {
    it('returns nascent when score is 0 and isFinal false', () => {
        expect(cardDisplayState(0, false)).toBe('nascent');
    });
    it('returns nascent when score is 0.249 and isFinal false', () => {
        expect(cardDisplayState(0.249, false)).toBe('nascent');
    });
    it('returns nascent when score is 0 and isFinal true', () => {
        expect(cardDisplayState(0, true)).toBe('nascent');
    });
    it('returns forming when score is 0.25 and isFinal false', () => {
        expect(cardDisplayState(0.25, false)).toBe('forming');
    });
    it('returns forming when score is 0.5 and isFinal false', () => {
        expect(cardDisplayState(0.5, false)).toBe('forming');
    });
    it('returns forming when score is 0.749 and isFinal false', () => {
        expect(cardDisplayState(0.749, false)).toBe('forming');
    });
    it('returns forming when score is 0.75 and isFinal false (race condition guard)', () => {
        expect(cardDisplayState(0.75, false)).toBe('forming');
    });
    it('returns forming when score is 1.0 and isFinal false (race condition guard)', () => {
        expect(cardDisplayState(1.0, false)).toBe('forming');
    });
    it('returns settled when score is 0.75 and isFinal true', () => {
        expect(cardDisplayState(0.75, true)).toBe('settled');
    });
    it('returns settled when score is 1.0 and isFinal true', () => {
        expect(cardDisplayState(1.0, true)).toBe('settled');
    });
    it('returns forming when score is 0.76 and isFinal false', () => {
        expect(cardDisplayState(0.76, false)).toBe('forming');
    });
    it('returns settled when score is 0.76 and isFinal true', () => {
        expect(cardDisplayState(0.76, true)).toBe('settled');
    });
});
