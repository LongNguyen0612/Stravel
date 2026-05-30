export function cardDisplayState(score, isFinal) {
    if (score >= 0.75 && isFinal)
        return 'settled';
    if (score >= 0.25)
        return 'forming';
    return 'nascent';
}
