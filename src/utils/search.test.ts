import { describe, expect, it } from 'vitest'
import { addRecentSearch, highlightParts, matchesAll, searchTerms } from './search'

describe('searchTerms', () => {
  it('lower-cases, splits on any spacing and drops commas', () => {
    expect(searchTerms('  Seafood   CORON 4,800 ')).toEqual(['seafood', 'coron', '4800'])
  })

  it('keeps at most eight words and ignores a blank query', () => {
    expect(searchTerms('a b c d e f g h i j')).toHaveLength(8)
    expect(searchTerms('   ')).toEqual([])
  })
})

describe('matchesAll', () => {
  it('needs every word, in any order, across the texts', () => {
    expect(matchesAll(['Coron Getaway', 'Palawan'], ['palawan', 'coron'])).toBe(true)
    expect(matchesAll(['Coron Getaway', null], ['coron', 'bohol'])).toBe(false)
  })

  it('matches nothing without words', () => {
    expect(matchesAll(['Coron'], [])).toBe(false)
  })
})

describe('highlightParts', () => {
  it('marks every occurrence of the words, keeping the original case', () => {
    expect(highlightParts('Seafood dinner at Seafood Island', ['seafood'])).toEqual([
      { text: 'Seafood', match: true },
      { text: ' dinner at ', match: false },
      { text: 'Seafood', match: true },
      { text: ' Island', match: false },
    ])
  })

  it('prefers the longer word when two overlap, and treats symbols literally', () => {
    expect(highlightParts('Sea seafood', ['sea', 'seafood'])).toEqual([
      { text: 'Sea', match: true },
      { text: ' ', match: false },
      { text: 'seafood', match: true },
    ])
    expect(highlightParts('100% (cash)', ['(cash)'])).toEqual([
      { text: '100% ', match: false },
      { text: '(cash)', match: true },
    ])
  })

  it('returns the text unchanged without words', () => {
    expect(highlightParts('Dinner', [])).toEqual([{ text: 'Dinner', match: false }])
  })
})

describe('addRecentSearch', () => {
  it('puts the newest first without repeats, trimmed', () => {
    expect(addRecentSearch(['coron', 'Grab'], '  grab  ')).toEqual(['grab', 'coron'])
  })

  it('ignores one-letter searches and keeps at most six', () => {
    expect(addRecentSearch(['coron'], 'x')).toEqual(['coron'])
    expect(addRecentSearch(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], 'new')).toEqual(['new', 'a1', 'a2', 'a3', 'a4', 'a5'])
  })
})
