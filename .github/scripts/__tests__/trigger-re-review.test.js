/**
 * Testes para trigger-re-review.cjs
 *
 * @run node .github/scripts/__tests__/trigger-re-review.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  CRITICAL_PATTERNS,
  CHANGES_THRESHOLD,
  getLastGeminiReviewTimestamp,
  getCommitsSinceTimestamp,
  getChangedFiles,
  shouldTriggerRereview,
  triggerRereview,
} = require('../trigger-re-review.cjs')

// Minimal async mock factory: each method gets its own independent mock
function mockFn() {
  let _resolved
  const calls = []
  const fn = async (...args) => {
    calls.push(args)
    return _resolved
  }
  fn.mockResolvedValue = (v) => { _resolved = v }
  fn.calls = calls
  return fn
}

function createMockGithub() {
  return {
    rest: {
      pulls: {
        listReviews: mockFn(),
        listCommits: mockFn(),
        listFiles: mockFn(),
        listReviewComments: mockFn(),
      },
      issues: {
        listComments: mockFn(),
        createComment: mockFn(),
      },
    },
  }
}

function createMockContext() {
  return { repo: { owner: 'test-owner', repo: 'test-repo' } }
}

describe('trigger-re-review', () => {
  describe('CRITICAL_PATTERNS', () => {
    it('deve identificar arquivos críticos em src/services/', () => {
      const pattern = CRITICAL_PATTERNS[0]
      assert.equal(pattern.test('src/services/medicineService.js'), true)
      assert.equal(pattern.test('src/components/Button.jsx'), false)
    })

    it('deve identificar arquivos críticos em src/schemas/', () => {
      const pattern = CRITICAL_PATTERNS[1]
      assert.equal(pattern.test('src/schemas/medicineSchema.js'), true)
      assert.equal(pattern.test('src/utils/helpers.js'), false)
    })

    it('deve identificar arquivos críticos em server/bot/', () => {
      const pattern = CRITICAL_PATTERNS[2]
      assert.equal(pattern.test('server/bot/tasks.js'), true)
      assert.equal(pattern.test('server/services/medicines.js'), false)
    })

    it('deve identificar arquivos críticos em api/', () => {
      const pattern = CRITICAL_PATTERNS[3]
      assert.equal(pattern.test('api/notify.js'), true)
      assert.equal(pattern.test('api/dlq/[id]/retry.js'), true)
      assert.equal(pattern.test('src/api/client.js'), false)
    })
  })

  describe('CHANGES_THRESHOLD', () => {
    it('deve ter threshold de 50 linhas', () => {
      assert.equal(CHANGES_THRESHOLD, 50)
    })
  })

  describe('getLastGeminiReviewTimestamp', () => {
    it('deve retornar null quando não há reviews do Gemini', async () => {
      const github = createMockGithub()
      github.rest.pulls.listReviews.mockResolvedValue({ data: [] })
      github.rest.issues.listComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] })

      const result = await getLastGeminiReviewTimestamp(github, 'owner', 'repo', 123)
      assert.equal(result, null)
    })

    it('deve retornar o timestamp mais recente dos reviews do Gemini', async () => {
      const github = createMockGithub()
      github.rest.pulls.listReviews.mockResolvedValue({
        data: [
          { user: { login: 'gemini-code-assist[bot]' }, submitted_at: '2026-02-20T10:00:00Z' },
          { user: { login: 'gemini-code-assist[bot]' }, submitted_at: '2026-02-20T12:00:00Z' },
        ],
      })
      github.rest.issues.listComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] })

      const result = await getLastGeminiReviewTimestamp(github, 'owner', 'repo', 123)
      assert.deepEqual(result, new Date('2026-02-20T12:00:00Z'))
    })
  })

  describe('getCommitsSinceTimestamp', () => {
    it('deve retornar apenas commits após o timestamp', async () => {
      const github = createMockGithub()
      github.rest.pulls.listCommits.mockResolvedValue({
        data: [
          { sha: 'abc123', commit: { committer: { date: '2026-02-20T10:00:00Z' } } },
          { sha: 'def456', commit: { committer: { date: '2026-02-20T14:00:00Z' } } },
        ],
      })

      const sinceTimestamp = new Date('2026-02-20T11:00:00Z')
      const result = await getCommitsSinceTimestamp(github, 'owner', 'repo', 123, sinceTimestamp)

      assert.equal(result.length, 1)
      assert.equal(result[0].sha, 'def456')
    })
  })

  describe('getChangedFiles', () => {
    it('deve retornar lista de arquivos alterados', async () => {
      const github = createMockGithub()
      const mockFiles = [
        { filename: 'src/services/medicineService.js', additions: 10, deletions: 5 },
        { filename: 'src/components/Button.jsx', additions: 2, deletions: 1 },
      ]
      github.rest.pulls.listFiles.mockResolvedValue({ data: mockFiles })

      const result = await getChangedFiles(github, 'owner', 'repo', 123)
      assert.deepEqual(result, mockFiles)
    })
  })

  describe('shouldTriggerRereview', () => {
    it('deve retornar true quando arquivo crítico é modificado', async () => {
      const github = createMockGithub()
      github.rest.pulls.listReviews.mockResolvedValue({
        data: [{ user: { login: 'gemini-code-assist[bot]' }, submitted_at: '2026-02-20T10:00:00Z' }],
      })
      github.rest.issues.listComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listCommits.mockResolvedValue({
        data: [{ sha: 'abc123', commit: { committer: { date: '2026-02-20T14:00:00Z' } } }],
      })
      github.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/services/medicineService.js', additions: 5, deletions: 2 }],
      })

      const result = await shouldTriggerRereview(123, github, createMockContext())
      assert.equal(result, true)
    })

    it('deve retornar true quando mais de 50 linhas são alteradas', async () => {
      const github = createMockGithub()
      github.rest.pulls.listReviews.mockResolvedValue({
        data: [{ user: { login: 'gemini-code-assist[bot]' }, submitted_at: '2026-02-20T10:00:00Z' }],
      })
      github.rest.issues.listComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listCommits.mockResolvedValue({
        data: [{ sha: 'abc123', commit: { committer: { date: '2026-02-20T14:00:00Z' } } }],
      })
      github.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/components/Button.jsx', additions: 30, deletions: 25 }],
      })

      const result = await shouldTriggerRereview(123, github, createMockContext())
      assert.equal(result, true)
    })

    it('deve retornar false quando não há novos commits', async () => {
      const github = createMockGithub()
      github.rest.pulls.listReviews.mockResolvedValue({
        data: [{ user: { login: 'gemini-code-assist[bot]' }, submitted_at: '2026-02-20T15:00:00Z' }],
      })
      github.rest.issues.listComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listCommits.mockResolvedValue({
        data: [{ sha: 'abc123', commit: { committer: { date: '2026-02-20T10:00:00Z' } } }],
      })

      const result = await shouldTriggerRereview(123, github, createMockContext())
      assert.equal(result, false)
    })

    it('deve retornar false quando não há review do Gemini', async () => {
      const github = createMockGithub()
      github.rest.pulls.listReviews.mockResolvedValue({ data: [] })
      github.rest.issues.listComments.mockResolvedValue({ data: [] })
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] })

      const result = await shouldTriggerRereview(123, github, createMockContext())
      assert.equal(result, false)
    })
  })

  describe('triggerRereview', () => {
    it('deve postar comentário com /gemini review', async () => {
      const github = createMockGithub()
      github.rest.issues.createComment.mockResolvedValue({ data: {} })

      await triggerRereview(123, github, createMockContext())

      const call = github.rest.issues.createComment.calls[0]?.[0]
      assert.ok(call, 'createComment deve ter sido chamado')
      assert.equal(call.owner, 'test-owner')
      assert.equal(call.repo, 'test-repo')
      assert.equal(call.issue_number, 123)
      assert.ok(call.body.includes('/gemini review'), 'body deve conter /gemini review')
    })
  })
})
