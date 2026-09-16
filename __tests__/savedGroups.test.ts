/**
 * @jest-environment jsdom
 */
import { saveGroup, getSavedGroups, getSavedGroup, deleteGroup } from '../src/lib/savedGroups'

const people = [{ name: 'Alex', color: '#c9a84c' }, { name: 'Sam', color: '#6fa8dc', venmoHandle: 'sam' }]

beforeEach(() => localStorage.clear())

describe('savedGroups', () => {
  it('assigns a unique id to each new group, newest first', () => {
    const a = saveGroup({ name: 'Roommates', people })
    const b = saveGroup({ name: 'Work', people })
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(b.id).not.toBe(a.id)
    expect(getSavedGroups().map(g => g.name)).toEqual(['Work', 'Roommates'])
  })

  it('updates an existing group in place', () => {
    const group = saveGroup({ name: 'Roommates', people })
    saveGroup({ id: group.id, name: 'Old roommates', people })
    expect(getSavedGroups()).toHaveLength(1)
    expect(getSavedGroup(group.id)?.name).toBe('Old roommates')
  })

  it('deletes a group', () => {
    const group = saveGroup({ name: 'Roommates', people })
    deleteGroup(group.id)
    expect(getSavedGroup(group.id)).toBeNull()
  })
})
