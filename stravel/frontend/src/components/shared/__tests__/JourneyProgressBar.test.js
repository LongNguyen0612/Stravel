import { jsx as _jsx } from "react/jsx-runtime";
import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyProgressBar } from '../JourneyProgressBar';
describe('JourneyProgressBar', () => {
    it('renders nothing when hasStarted is false', () => {
        const { container } = render(_jsx(JourneyProgressBar, { stage: "idle", hasStarted: false, onStageClick: vi.fn() }));
        expect(container).toBeEmptyDOMElement();
    });
    it('renders outer container when hasStarted is true', () => {
        render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: vi.fn() }));
        expect(screen.getByTestId('journey-progress-bar')).toBeInTheDocument();
    });
    it('renders exactly 4 stage step buttons', () => {
        render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: vi.fn() }));
        expect(screen.getByTestId('stage-step-profiling')).toBeInTheDocument();
        expect(screen.getByTestId('stage-step-calculating')).toBeInTheDocument();
        expect(screen.getByTestId('stage-step-proposing')).toBeInTheDocument();
        expect(screen.getByTestId('stage-step-validating')).toBeInTheDocument();
    });
    it('renders correct label text for each stage', () => {
        render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: vi.fn() }));
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Budget')).toBeInTheDocument();
        expect(screen.getByText('Proposal')).toBeInTheDocument();
        expect(screen.getByText('Review')).toBeInTheDocument();
    });
    it('current stage (profiling) has teal color', () => {
        render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: vi.fn() }));
        const step = screen.getByTestId('stage-step-profiling');
        expect(step).toHaveStyle({ color: '#0d9488' });
    });
    it('current stage has bold font weight', () => {
        render(_jsx(JourneyProgressBar, { stage: "calculating", hasStarted: true, onStageClick: vi.fn() }));
        const step = screen.getByTestId('stage-step-calculating');
        expect(step).toHaveStyle({ fontWeight: '700' });
    });
    it('future stages do not have teal color', () => {
        render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: vi.fn() }));
        const futureStep = screen.getByTestId('stage-step-calculating');
        expect(futureStep).not.toHaveStyle({ color: '#0d9488' });
    });
    it('completed stages do not have teal color (muted)', () => {
        render(_jsx(JourneyProgressBar, { stage: "proposing", hasStarted: true, onStageClick: vi.fn() }));
        const doneStep = screen.getByTestId('stage-step-profiling');
        expect(doneStep).not.toHaveStyle({ color: '#0d9488' });
    });
    it('calls onStageClick with correct stage when a completed stage is clicked', () => {
        const onStageClick = vi.fn();
        render(_jsx(JourneyProgressBar, { stage: "proposing", hasStarted: true, onStageClick: onStageClick }));
        // profiling is completed when stage is proposing
        fireEvent.click(screen.getByTestId('stage-step-profiling'));
        expect(onStageClick).toHaveBeenCalledWith('profiling');
    });
    it('calls onStageClick for second completed stage', () => {
        const onStageClick = vi.fn();
        render(_jsx(JourneyProgressBar, { stage: "validating", hasStarted: true, onStageClick: onStageClick }));
        fireEvent.click(screen.getByTestId('stage-step-calculating'));
        expect(onStageClick).toHaveBeenCalledWith('calculating');
    });
    it('does not call onStageClick when current stage button is clicked (disabled)', () => {
        const onStageClick = vi.fn();
        render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: onStageClick }));
        fireEvent.click(screen.getByTestId('stage-step-profiling'));
        expect(onStageClick).not.toHaveBeenCalled();
    });
    it('does not call onStageClick for future stages (disabled)', () => {
        const onStageClick = vi.fn();
        render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: onStageClick }));
        fireEvent.click(screen.getByTestId('stage-step-calculating'));
        expect(onStageClick).not.toHaveBeenCalled();
    });
    it('current stage step is disabled', () => {
        render(_jsx(JourneyProgressBar, { stage: "calculating", hasStarted: true, onStageClick: vi.fn() }));
        expect(screen.getByTestId('stage-step-calculating')).toBeDisabled();
    });
    it('completed stage step is not disabled (clickable)', () => {
        render(_jsx(JourneyProgressBar, { stage: "proposing", hasStarted: true, onStageClick: vi.fn() }));
        expect(screen.getByTestId('stage-step-profiling')).not.toBeDisabled();
    });
    it('future stage step is disabled', () => {
        render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: vi.fn() }));
        expect(screen.getByTestId('stage-step-calculating')).toBeDisabled();
    });
});
