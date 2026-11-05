import { describe, expect, it } from 'vitest'
import { keyAction, movePaletteIndex } from './keyboard'
import type { KeyContext } from './keyboard'

const base: KeyContext = {
  key: '/',
  mod: false,
  focus: 'editor',
  selectionEmpty: true,
  onEmptyLine: false,
  overlayOpen: false,
  reviewing: false,
}

describe('keyAction', () => {
  it('typing a slash in a sentence stays text', () => {
    expect(keyAction(base)).toBeNull()
  })

  it('a slash with text selected opens the palette', () => {
    expect(keyAction({ ...base, selectionEmpty: false })).toBe('palette')
  })

  it('a slash on an empty line opens the palette', () => {
    expect(keyAction({ ...base, onEmptyLine: true })).toBe('palette')
  })

  it('a slash outside the editor opens the palette', () => {
    expect(keyAction({ ...base, focus: 'other' })).toBe('palette')
  })

  it('a slash in an input stays text, even with a selection in the document', () => {
    expect(keyAction({ ...base, focus: 'input', selectionEmpty: false, onEmptyLine: true })).toBeNull()
  })

  it('a question mark in the editor stays text', () => {
    expect(keyAction({ ...base, key: '?' })).toBeNull()
  })

  it('a question mark in an input stays text', () => {
    expect(keyAction({ ...base, key: '?', focus: 'input' })).toBeNull()
  })

  it('a question mark outside the editor opens the shortcuts', () => {
    expect(keyAction({ ...base, key: '?', focus: 'other' })).toBe('shortcuts')
  })

  it('Ctrl+Enter accepts all during a review', () => {
    expect(keyAction({ ...base, key: 'Enter', mod: true, reviewing: true })).toBe('acceptAll')
  })

  it('Ctrl+Enter does nothing with no review', () => {
    expect(keyAction({ ...base, key: 'Enter', mod: true })).toBeNull()
  })

  it('Ctrl+Enter in the refine field does not accept by accident', () => {
    expect(keyAction({ ...base, key: 'Enter', mod: true, reviewing: true, focus: 'input' })).toBeNull()
  })

  it('Esc dismisses, from the editor or from outside it', () => {
    expect(keyAction({ ...base, key: 'Escape' })).toBe('dismiss')
    expect(keyAction({ ...base, key: 'Escape', focus: 'other' })).toBe('dismiss')
  })

  it('Esc in an input only leaves the input', () => {
    expect(keyAction({ ...base, key: 'Escape', focus: 'input' })).toBe('leaveInput')
  })

  it('Ctrl+Z outside the editor undoes in the document', () => {
    expect(keyAction({ ...base, key: 'z', mod: true, focus: 'other' })).toBe('undo')
  })

  it('Ctrl+Z in the editor or an input is left to them', () => {
    expect(keyAction({ ...base, key: 'z', mod: true })).toBeNull()
    expect(keyAction({ ...base, key: 'z', mod: true, focus: 'input' })).toBeNull()
  })

  it('Ctrl with a slash is not the palette', () => {
    expect(keyAction({ ...base, mod: true, focus: 'other' })).toBeNull()
  })

  it('an open palette or dialog handles its own keys', () => {
    expect(keyAction({ ...base, overlayOpen: true, focus: 'other' })).toBeNull()
    expect(keyAction({ ...base, key: 'Escape', overlayOpen: true })).toBeNull()
  })
})

describe('movePaletteIndex', () => {
  it('the palette moves with the arrows and wraps around', () => {
    expect(movePaletteIndex(0, 7, 'ArrowDown')).toBe(1)
    expect(movePaletteIndex(6, 7, 'ArrowDown')).toBe(0)
    expect(movePaletteIndex(0, 7, 'ArrowUp')).toBe(6)
  })

  it('other keys leave the highlight alone', () => {
    expect(movePaletteIndex(3, 7, 'a')).toBe(3)
  })
})
