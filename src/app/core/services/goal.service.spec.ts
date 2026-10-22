import { TestBed } from '@angular/core/testing';
import { GoalService, goalProgress } from './goal.service';
import { Goal } from '../models/goal.model';

const NOW = new Date(2025, 0, 15);
const goal = (overrides: Partial<Goal> = {}): Goal =>
  ({ id: 'g', name: 'Viaje', target: 1000000, saved: 400000, deadline: null, ...overrides });

describe('goalProgress', () => {
  it('should report what is missing without a deadline', () => {
    expect(goalProgress(goal(), NOW)).toEqual({ ratio: 0.4, remaining: 600000, done: false, overdue: false, monthlyNeeded: null });
  });

  it('should split what is missing over the months left, counting this one', () => {
    // January to June is 6 months.
    expect(goalProgress(goal({ deadline: '2025-06-30' }), NOW).monthlyNeeded).toBe(100000);
    expect(goalProgress(goal({ deadline: '2025-01-31' }), NOW).monthlyNeeded).toBe(600000);
  });

  it('should flag a passed deadline', () => {
    const progress = goalProgress(goal({ deadline: '2025-01-14' }), NOW);
    expect(progress.overdue).toBe(true);
    expect(progress.monthlyNeeded).toBeNull();
  });

  it('should mark a reached goal as done even past its deadline', () => {
    expect(goalProgress(goal({ saved: 1200000, deadline: '2024-12-31' }), NOW))
      .toEqual({ ratio: 1, remaining: 0, done: true, overdue: false, monthlyNeeded: null });
  });
});

describe('GoalService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('should add goals with nothing saved and persist them', () => {
    const service = TestBed.inject(GoalService);
    const created = service.add({ name: 'Viaje', target: 1000000, deadline: null });

    expect(created.saved).toBe(0);
    expect(JSON.parse(localStorage.getItem('goals')!)).toEqual([created]);
  });

  it('should add and withdraw money without going below zero', () => {
    const service = TestBed.inject(GoalService);
    const { id } = service.add({ name: 'Viaje', target: 1000000, deadline: null });

    service.contribute(id, 300000);
    service.contribute(id, -100000);
    expect(service.goals()[0].saved).toBe(200000);

    service.contribute(id, -500000);
    expect(service.goals()[0].saved).toBe(0);
  });

  it('should edit and remove goals', () => {
    const service = TestBed.inject(GoalService);
    const { id } = service.add({ name: 'Viaje', target: 1000000, deadline: null });

    service.update(id, { name: 'Viaje al sur', target: 1500000, deadline: '2025-12-31' });
    expect(service.goals()[0]).toMatchObject({ name: 'Viaje al sur', target: 1500000, deadline: '2025-12-31' });

    service.remove(id);
    expect(service.goals()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('goals')!)).toEqual([]);
  });
});
