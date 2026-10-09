import { describe, expect, it } from 'vitest'
import { getTripStatus, hasTripEnded, initialTripStatus, todayIso, tripLengthInDays } from './tripStatus'

const trip = { status: 'upcoming' as const, start_date: '2026-11-03', end_date: '2026-11-08' }

describe('getTripStatus', () => {
  it('is upcoming before the start date', () => {
    expect(getTripStatus(trip, '2026-11-02')).toBe('upcoming')
  })

  it('is active from the start date, even if stored as upcoming', () => {
    expect(getTripStatus(trip, '2026-11-03')).toBe('active')
    expect(getTripStatus(trip, '2026-11-08')).toBe('active')
  })

  it('stays active after the end date until it is completed', () => {
    expect(getTripStatus(trip, '2026-11-20')).toBe('active')
    expect(hasTripEnded(trip, '2026-11-20')).toBe(true)
  })

  it('respects an explicit completion', () => {
    expect(getTripStatus({ ...trip, status: 'completed' }, '2026-11-04')).toBe('completed')
  })
})

describe('helpers', () => {
  it('counts trip days inclusively', () => {
    expect(tripLengthInDays('2026-11-03', '2026-11-08')).toBe(6)
    expect(tripLengthInDays('2026-11-03', '2026-11-03')).toBe(1)
  })

  it('picks the stored status for new trips', () => {
    expect(initialTripStatus('2026-11-03', '2026-10-09')).toBe('upcoming')
    expect(initialTripStatus('2026-10-01', '2026-10-09')).toBe('active')
  })

  it('formats today as a calendar date', () => {
    expect(todayIso(new Date(2026, 9, 9, 23, 30))).toBe('2026-10-09')
  })
})
