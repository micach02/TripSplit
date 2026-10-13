import { describe, expect, it } from 'vitest'
import { buildSuggestions, frequentCategoryIds, matchSuggestions, type PastExpense } from '@/utils/suggestions'

const past: PastExpense[] = [
  { description: 'Jollibee', categoryId: 'dining', amount: '385.00', currency: 'PHP', paymentMethod: 'gcash', createdAt: '2026-10-12T10:00:00Z' },
  { description: 'Puregold groceries', categoryId: 'groceries', amount: '2400.00', currency: 'PHP', paymentMethod: 'card', createdAt: '2026-10-11T10:00:00Z' },
  { description: 'jollibee ', categoryId: 'dining', amount: '350.00', currency: 'PHP', paymentMethod: 'cash', createdAt: '2026-10-05T10:00:00Z' },
  { description: 'Grab to work', categoryId: 'transport', amount: '210.00', currency: 'PHP', paymentMethod: 'gcash', createdAt: '2026-10-04T10:00:00Z' },
  { description: 'Meralco', categoryId: 'bills', amount: '3125.50', currency: 'PHP', paymentMethod: null, createdAt: '2026-09-15T10:00:00Z' },
]

describe('buildSuggestions', () => {
  it('merges repeats, keeps the latest details and puts the most used first', () => {
    const suggestions = buildSuggestions(past)
    expect(suggestions[0]).toEqual({
      description: 'Jollibee',
      categoryId: 'dining',
      amount: '385.00',
      currency: 'PHP',
      paymentMethod: 'gcash',
      uses: 2,
    })
    expect(suggestions).toHaveLength(4)
  })
})

describe('matchSuggestions', () => {
  const suggestions = buildSuggestions(past)

  it('matches starts, then word starts, then anywhere', () => {
    expect(matchSuggestions('g', suggestions).map((s) => s.description)).toEqual(['Grab to work', 'Puregold groceries'])
    expect(matchSuggestions('gold', suggestions).map((s) => s.description)).toEqual(['Puregold groceries'])
    expect(matchSuggestions('JOLLI', suggestions).map((s) => s.description)).toEqual(['Jollibee'])
  })

  it('hides an exact match (it’s already typed) and shows favourites when empty', () => {
    expect(matchSuggestions('jollibee', suggestions)).toEqual([])
    expect(matchSuggestions('', suggestions, 2).map((s) => s.description)).toEqual(['Jollibee', 'Puregold groceries'])
  })
})

describe('frequentCategoryIds', () => {
  it('ranks categories by recent use', () => {
    expect(frequentCategoryIds(past, 2)).toEqual(['dining', 'groceries'])
  })
})
