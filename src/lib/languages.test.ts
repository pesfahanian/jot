import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hunspellSpeller } from './hunspell'
import { LANGUAGE, languageFor, scriptOf } from './languages'
import { suggestionFor } from './spelling'
import { translationPlan, translationPrefs } from '@/state/annotate'

describe('which language checks a word', () => {
  const none = new Set<string>()
  const both = new Set(['fa', 'ar', 'fr'])
  it('knows a word\'s script', () => {
    expect(['hello', 'café', 'سلام', 'مرحبا', '۱۲', 'привет'].map(scriptOf)).toEqual(['latin', 'latin', 'arabic', 'arabic', 'arabic', null])
  })
  it('checks Latin words in English until a pack is chosen, in settings or for the document', () => {
    expect(languageFor('latin', none, 'en')).toBe('en')
    expect(languageFor('latin', both, 'fr')).toBe('fr')
    expect(languageFor('latin', both, 'en', { latin: 'fr' })).toBe('fr')
    // A chosen pack that was removed falls back to English.
    expect(languageFor('latin', none, 'fr', { latin: 'de' })).toBe('en')
  })
  it('checks Farsi-script words only with a pack, Farsi first unless the document says Arabic', () => {
    expect(languageFor('arabic', none, 'en')).toBeNull()
    expect(languageFor('arabic', both, 'en')).toBe('fa')
    expect(languageFor('arabic', both, 'en', { arabic: 'ar' })).toBe('ar')
    expect(languageFor('arabic', new Set(['ar']), 'en')).toBe('ar')
  })
})

describe('translation defaults', () => {
  it('do what translating always did: Farsi into English, anything else into Farsi', () => {
    const p = translationPrefs({})
    expect(translationPlan('hello there', p)).toEqual({ source: null, target: 'fa', shown: 'en' })
    expect(translationPlan('سلام دنیا', p)).toEqual({ source: null, target: 'en', shown: 'fa' })
  })
  it('follow the chosen languages', () => {
    const p = translationPrefs({ translateFrom: 'de', translateTo: 'fr', translateBack: 'en' })
    expect(translationPlan('guten Tag', p)).toEqual({ source: 'de', target: 'fr', shown: 'de' })
    expect(translationPlan('bonjour', translationPrefs({ translateFrom: 'fr', translateTo: 'fr' }))).toEqual({ source: 'fr', target: 'en', shown: 'fr' })
  })
})

describe('packs', () => {
  it('suggest Farsi fixes, ranked on the Persian keyboard', async () => {
    const spell = await hunspellSpeller(readFileSync('public/packs/fa/index.aff', 'utf8'), readFileSync('public/packs/fa/index.dic', 'utf8'), { ownSuggestions: true })
    const fa = LANGUAGE.get('fa')!
    expect(suggestionFor(spell, 'کتاب', '', fa)).toBeNull()
    // A letter left out of کتابخانه (library).
    expect(suggestionFor(spell, 'کتابخنه', '', fa)?.fixes[0]).toBe('کتابخانه')
    // Never sure, so "fix all" leaves Farsi alone (open decision #32).
    expect(suggestionFor(spell, 'میخوام', '', fa)?.sure).toBe(false)
    expect(suggestionFor(spell, 'کتابخنه', '', fa)?.sure).toBe(false)
    spell.dispose()
  }, 60_000)
  it('suggest French fixes with accents', async () => {
    const spell = await hunspellSpeller(readFileSync('public/packs/fr/index.aff', 'utf8'), readFileSync('public/packs/fr/index.dic', 'utf8'), { ownSuggestions: true })
    const fr = LANGUAGE.get('fr')!
    expect(suggestionFor(spell, 'maison', '', fr)).toBeNull()
    expect(suggestionFor(spell, 'bibliotheque', '', fr)?.fixes[0]).toBe('bibliothèque')
    spell.dispose()
  }, 60_000)
})
