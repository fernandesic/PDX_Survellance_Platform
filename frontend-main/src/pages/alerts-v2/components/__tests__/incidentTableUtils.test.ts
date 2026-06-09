import { describe, it, expect } from 'vitest';
import {
  computeIncidentDurationDays,
  filterIncidents,
  formatIncidentDuration,
  toIncidentRow,
} from '../incidentTableUtils';
import type { Incident } from '../../types';

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 1,
    country: { id: 1, country: 'Nigeria', state: 'Lagos' },
    ihmref_data: {
      id: 1,
      category: 'vector_borne',
      year: '2024',
      afro: 12,
      global_t: 200,
      contribution: '6',
      no_of_african_countries: 4,
    },
    incident: 'Yellow fever outbreak',
    start_date: '2024-05-01',
    end_date: '2024-05-21',
    ...overrides,
  };
}

describe('computeIncidentDurationDays', () => {
  it('returns null when either date is missing', () => {
    expect(computeIncidentDurationDays(undefined, '2024-05-01')).toBeNull();
    expect(computeIncidentDurationDays('2024-05-01', undefined)).toBeNull();
    expect(computeIncidentDurationDays(undefined, undefined)).toBeNull();
  });

  it('returns null when end precedes start', () => {
    expect(computeIncidentDurationDays('2024-05-10', '2024-05-01')).toBeNull();
  });

  it('returns null for unparseable dates', () => {
    expect(computeIncidentDurationDays('not a date', '2024-05-01')).toBeNull();
  });

  it('rounds up whole days inclusive of the final day', () => {
    expect(computeIncidentDurationDays('2024-05-01', '2024-05-21')).toBe(20);
  });
});

describe('formatIncidentDuration', () => {
  it('returns "Ongoing" when start present but end missing', () => {
    expect(formatIncidentDuration('2024-05-01', undefined)).toBe('Ongoing');
  });

  it('returns em-dash when both are missing', () => {
    expect(formatIncidentDuration(undefined, undefined)).toBe('—');
  });

  it('returns days under a month', () => {
    expect(formatIncidentDuration('2024-05-01', '2024-05-21')).toBe('20 days');
  });

  it('returns month-rounded label when >= 30 days', () => {
    expect(formatIncidentDuration('2024-01-01', '2024-03-01')).toBe('~2 months');
    expect(formatIncidentDuration('2024-01-01', '2024-02-01')).toBe('~1 month');
  });

  it('renders 1 day correctly', () => {
    expect(formatIncidentDuration('2024-05-01', '2024-05-02')).toBe('1 day');
  });
});

describe('toIncidentRow', () => {
  it('flattens a fully-populated incident', () => {
    const row = toIncidentRow(makeIncident());
    expect(row).toEqual({
      id: 1,
      incidentName: 'Yellow fever outbreak',
      countryName: 'Nigeria',
      state: 'Lagos',
      category: 'vector borne',
      year: '2024',
      afro: '12',
      global: '200',
      durationLabel: '20 days',
    });
  });

  it('falls back to "General Incident" when name is blank', () => {
    const row = toIncidentRow(makeIncident({ incident: '' }));
    expect(row.incidentName).toBe('General Incident');
  });

  it('replaces underscores in the category label', () => {
    const row = toIncidentRow(
      makeIncident({
        ihmref_data: {
          id: 2,
          category: 'airborne_respiratory',
          year: '2023',
          afro: 0,
          global_t: 0,
          contribution: '0',
          no_of_african_countries: 0,
        },
      }),
    );
    expect(row.category).toBe('airborne respiratory');
  });

  it('renders em-dash when country is missing', () => {
    const row = toIncidentRow(
      makeIncident({ country: { id: 0, country: '' } }),
    );
    expect(row.countryName).toBe('—');
    expect(row.state).toBeUndefined();
  });

  it('renders "—" for missing afro/global counts', () => {
    const row = toIncidentRow(
      makeIncident({
        ihmref_data: {
          id: 3,
          category: 'other',
          year: '',
          afro: undefined as unknown as number,
          global_t: undefined as unknown as number,
          contribution: '',
          no_of_african_countries: 0,
        },
      }),
    );
    expect(row.afro).toBe('—');
    expect(row.global).toBe('—');
    expect(row.year).toBe('—');
  });

  it('reports "Ongoing" duration when end date is absent', () => {
    const row = toIncidentRow(makeIncident({ end_date: undefined }));
    expect(row.durationLabel).toBe('Ongoing');
  });
});

describe('filterIncidents', () => {
  const sample: Incident[] = [
    makeIncident({
      id: 1,
      incident: 'Cholera outbreak',
      country: { id: 1, country: 'Nigeria' },
      ihmref_data: {
        id: 1,
        category: 'enteric',
        year: '2024',
        afro: 3,
        global_t: 20,
        contribution: '15',
        no_of_african_countries: 3,
      },
    }),
    makeIncident({
      id: 2,
      incident: 'Yellow fever cluster',
      country: { id: 2, country: 'Ghana' },
      ihmref_data: {
        id: 2,
        category: 'vector_borne',
        year: '2024',
        afro: 1,
        global_t: 5,
        contribution: '20',
        no_of_african_countries: 1,
      },
    }),
    makeIncident({
      id: 3,
      incident: 'Measles resurgence',
      country: { id: 3, country: 'Kenya' },
      ihmref_data: {
        id: 3,
        category: 'rash',
        year: '2025',
        afro: 2,
        global_t: 10,
        contribution: '20',
        no_of_african_countries: 2,
      },
    }),
  ];

  it('returns all incidents for empty query', () => {
    expect(filterIncidents(sample, '').length).toBe(3);
    expect(filterIncidents(sample, '   ').length).toBe(3);
  });

  it('matches on incident name (case-insensitive)', () => {
    expect(filterIncidents(sample, 'cholera').map((i) => i.id)).toEqual([1]);
    expect(filterIncidents(sample, 'MEASLES').map((i) => i.id)).toEqual([3]);
  });

  it('matches on country', () => {
    expect(filterIncidents(sample, 'ghana').map((i) => i.id)).toEqual([2]);
  });

  it('matches on category', () => {
    expect(filterIncidents(sample, 'vector').map((i) => i.id)).toEqual([2]);
  });

  it('returns empty when nothing matches', () => {
    expect(filterIncidents(sample, 'ebola')).toEqual([]);
  });
});
