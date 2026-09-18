import assert from 'node:assert/strict'
import test from 'node:test'
import { handlePhase3 } from './mock-phase3.mjs'

test('upload permission is sufficient to activate and replace the mock EHR snapshot', () => {
  const me = { username: 'ict', permissions: ['ehr_import.upload', 'ehr_import.read'] }
  const request = (path, m, user = me, body = {}) => {
    let response
    const handled = handlePhase3({
      req: { headers: {} }, res: {}, path, m, me: user, body, users: [],
      url: new URL(`http://localhost${path}?sourceAsAt=2026-01-01`),
      send: (_, status, data) => { response = { status, data } },
      err: (_, status, message) => { response = { status, message } },
    })
    assert.equal(handled, true)
    return response
  }
  const previousId = request('/admin/ehr-imports/active', 'GET').data.publicId
  const uploaded = request('/admin/ehr-imports', 'POST')
  assert.equal(uploaded.status, 200)
  assert.equal(uploaded.data.status, 'ACTIVE')
  assert.equal(uploaded.data.activatedBy, 'ict')
  assert.ok(uploaded.data.activatedAt)
  assert.equal(request('/admin/ehr-imports/active', 'GET').data.publicId, uploaded.data.publicId)
  const history = request('/admin/ehr-imports', 'GET').data
  assert.equal(history.filter((item) => item.status === 'ACTIVE').length, 1)
  assert.equal(history.find((item) => item.publicId === previousId).status, 'SUPERSEDED')
  assert.equal(request('/admin/ehr-imports', 'POST', { username: 'reader', permissions: [] }).status, 403)
  assert.equal(request('/admin/ehr-imports/active', 'GET').data.publicId, uploaded.data.publicId)
})

test('admin can add, edit and synchronize manual EHR details', () => {
  const me = { username: 'admin', permissions: ['ehr_import.read', 'ehr_import.upload', 'ehr_import.activate'] }
  const request = (path, m, body = {}) => {
    let response
    handlePhase3({
      req: { headers: {} }, res: {}, path, m, me, body, users: [], url: new URL(`http://localhost${path}`),
      send: (_, status, data) => { response = { status, data } },
      err: (_, status, message) => { response = { status, message } },
    })
    return response
  }
  const created = request('/admin/ehr-records/manual', 'POST', { ehrNumber: '309911', fullName: 'Manual Patient', dateOfBirth: '1982-02-03', phoneNumber: '08030001111', active: true, reason: 'Hospital card verified' })
  assert.equal(created.status, 201)
  assert.equal(created.data.syncStatus, 'MANUAL_ONLY')
  const updated = request(`/admin/ehr-records/manual/${created.data.publicId}`, 'PUT', { ...created.data, clinic: 'General Adult Clinic', reason: 'Clinic confirmed' })
  assert.equal(updated.data.version, 1)
  const synced = request(`/admin/ehr-records/manual/${created.data.publicId}/sync`, 'POST', { direction: 'TO_IMPORT', reason: 'Add to active working snapshot' })
  assert.equal(synced.data.syncStatus, 'MATCHED')
  assert.equal(synced.data.lastSyncDirection, 'TO_IMPORT')
})
