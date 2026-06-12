import { describe, expect, it, vi } from 'vitest'
import { defineMenu } from '../defineMenu.js'
import type { MenuInput } from '../types.js'

describe('defineMenu', () => {
  it('uses the entry key as the href and keeps insertion order', () => {
    const menu = defineMenu({
      '/': { title: 'Home' },
      '/about': { title: 'About' },
    })
    expect(menu.map((i) => i.href)).toEqual(['/', '/about'])
  })

  it('sorts siblings by `order` and strips input-only fields', () => {
    const menu = defineMenu({
      '/b': { title: 'B', order: 2 },
      '/a': { title: 'A', order: 1 },
    })
    expect(menu.map((i) => i.title)).toEqual(['A', 'B'])
    expect(menu[0]).not.toHaveProperty('order')
    expect(menu[0]).not.toHaveProperty('parent')
  })

  it('places unordered items after ordered ones, keeping insertion order', () => {
    const menu = defineMenu({
      '/p1': { title: 'Plain1' },
      '/o': { title: 'Ordered', order: 1 },
      '/p2': { title: 'Plain2' },
    })
    expect(menu.map((i) => i.title)).toEqual(['Ordered', 'Plain1', 'Plain2'])
  })

  it('resolves `parent` into a nested tree', () => {
    const menu = defineMenu({
      '/components': { title: 'Components' },
      '/button': { title: 'Button', parent: '/components' },
    })
    expect(menu).toHaveLength(1)
    expect(menu[0].items?.map((i) => i.href)).toEqual(['/button'])
  })

  it('supports a non-navigable container via `href: false`, addressed by its key', () => {
    const menu = defineMenu({
      grp: { title: 'Group', href: false },
      '/c': { title: 'Child', parent: 'grp' },
    })
    expect(menu).toHaveLength(1)
    expect(menu[0].href).toBeUndefined()
    expect(menu[0].items?.[0].href).toBe('/c')
  })

  it('hoists items with an unknown parent to the top level (with a warning)', () => {
    // Unknown-parent literals are a compile error; the runtime safety net is for
    // dynamically built menus where `parent` widens to `string`.
    const input: MenuInput = { '/o': { title: 'Orphan', parent: '/missing' } }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const menu = defineMenu(input)
    expect(menu.map((i) => i.href)).toEqual(['/o'])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('overrides a keyed entry on spread (later wins, position kept)', () => {
    const generated = { '/button': { title: 'Button' }, '/about': { title: 'About' } }
    const menu = defineMenu({
      ...generated,
      '/button': { title: 'Button (override)', icon: 'icon' },
    })
    expect(menu.map((i) => i.href)).toEqual(['/button', '/about'])
    expect(menu[0]).toMatchObject({ title: 'Button (override)', icon: 'icon' })
  })

  it('lets a later entry attach into an earlier section (custom child)', () => {
    const menu = defineMenu({
      '/components': { title: 'Components' },
      '/button': { title: 'Button', parent: '/components' },
      '/x': { title: 'Custom', parent: '/components' },
    })
    expect(menu[0].items?.map((i) => i.href)).toEqual(['/button', '/x'])
  })
})
