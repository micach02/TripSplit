import { describe, expect, it } from 'vitest'
import { isNamedPerson, shortName, splitNames, uniqueNames } from './people'

describe('splitNames', () => {
  it('splits on commas and new lines, trimming and dropping blanks', () => {
    expect(splitNames(' Ben,  Carl Cruz ,\nDana,, ')).toEqual(['Ben', 'Carl Cruz', 'Dana'])
  })

  it('squeezes repeated spaces inside a name', () => {
    expect(splitNames('Mary   Ann')).toEqual(['Mary Ann'])
  })

  it('returns nothing for an empty line', () => {
    expect(splitNames('  ,  ')).toEqual([])
  })
})

describe('uniqueNames', () => {
  it('drops repeats ignoring case and spacing, keeping the first spelling', () => {
    expect(uniqueNames(['Ben', 'ben ', 'Carl', 'BEN', 'carl  cruz', 'Carl Cruz'])).toEqual(['Ben', 'Carl', 'carl cruz'])
  })

  it('drops blanks', () => {
    expect(uniqueNames(['', '  ', 'Dana'])).toEqual(['Dana'])
  })
})

describe('shortName', () => {
  it('uses the first name when nobody else shares it', () => {
    expect(shortName('Carl Cruz', ['Ana Reyes', 'Ben B'])).toBe('Carl')
  })

  it('uses the full name when someone else has the same first name, ignoring case', () => {
    expect(shortName('Ben B', ['ben Santos', 'Ana'])).toBe('Ben B')
    expect(shortName('Ben', ['Ben B'])).toBe('Ben')
  })
})

describe('isNamedPerson', () => {
  it('is true only for people added by name', () => {
    expect(isNamedPerson({ profile: { guest_trip_id: 'trip-1' } })).toBe(true)
    expect(isNamedPerson({ profile: { guest_trip_id: null } })).toBe(false)
  })
})
