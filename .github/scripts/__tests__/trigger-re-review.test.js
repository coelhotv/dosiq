/**
 * Testes para trigger-re-review.js
 * 
 * @module trigger-re-review.test
 * @version 1.0.0
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock do cliente GitHub
function createMockGithub() {
  return {
    rest: {
      pulls: {
        listReviews: vi.fn(),
        listCommits: vi.fn(),
        listFiles: vi.fn(),
        listReviewComments: vi.fn()
      },
      issues: {
        listComments: vi.fn(),
        createComment: vi.fn()
      }
    }
  };
}

// Mock do contexto
function createMockContext() {
  return {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    }
  };
}

describe('trigger-re-review', () => {
  let triggerRereviewModule;

  beforeEach(async () => {
    // Limpar módulo do cache para recarregar
    delete require.cache[require.resolve('../trigger-re-review.js')];
    triggerRereviewModule = require('../trigger-re-review.js');
  });

  describe('CRITICAL_PATTERNS', () => {
    it('deve identificar arquivos críticos em src/services/', () => {
      const { CRITICAL_PATTERNS } = triggerRereviewModule;
      const pattern = CRITICAL_PATTERNS[0];
      expect(pattern.test('src/services/medicineService.js')).toBe(true);
      expect(pattern.test('src/components/Button.jsx')).toBe(false);
    });

    it('deve identificar arquivos críticos em src/schemas/', () => {
      const { CRITICAL_PATTERNS } = triggerRereviewModule;
      const pattern = CRITICAL_PATTERNS[1];
      expect(pattern.test('src/schemas/medicineSchema.js')).toBe(true);
      expect(pattern.test('src/utils/helpers.js')).toBe(false);
    });

    it('deve identificar arquivos críticos em server/bot/', () => {
      const { CRITICAL_PATTERNS } = triggerRereviewModule;
      const pattern = CRITICAL_PATTERNS[2];
      expect(pattern.test('server/bot/tasks.js')).toBe(true);
      expect(pattern.test('server/services/medicines.js')).toBe(false);
    });

    it('deve identificar arquivos críticos em api/', () => {
      const { CRITICAL_PATTERNS } = triggerRereviewModule;
      const pattern = CRITICAL_PATTERNS[3];
      expect(pattern.test('api/notify.js')).toBe(true);
      expect(pattern.test('api/dlq/[id]/retry.js')).toBe(true);
      expect(pattern.test('src/api/client.js')).toBe(false);
    });
  });

  describe('CHANGES_THRESHOLD', () => {
    it('deve ter threshold de 50 linhas', () => {
      const { CHANGES_THRESHOLD } = triggerRereviewModule;
      expect(CHANGES_THRESHOLD).toBe(50);
    });
  });

  describe('getLastGeminiReviewTimestamp', () => {
    it('deve retornar null quando não há reviews do Gemini', async () => {
      const github = createMockGithub();
      const { getLastGeminiReviewTimestamp } = triggerRereviewModule;

      github.rest.pulls.listReviews.mockResolvedValue({ data: [] });
      github.rest.issues.listComments.mockResolvedValue({ data: [] });
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      const result = await getLastGeminiReviewTimestamp(
        github,
        'owner',
        'repo',
        123
      );

      expect(result).toBeNull();
    });

    it('deve retornar o timestamp mais recente dos reviews do Gemini', async () => {
      const github = createMockGithub();
      const { getLastGeminiReviewTimestamp } = triggerRereviewModule;

      github.rest.pulls.listReviews.mockResolvedValue({
        data: [
          {
            user: { login: 'gemini-code-assist[bot]' },
            submitted_at: '2026-02-20T10:00:00Z'
          },
          {
            user: { login: 'gemini-code-assist[bot]' },
            submitted_at: '2026-02-20T12:00:00Z'
          }
        ]
      });
      github.rest.issues.listComments.mockResolvedValue({ data: [] });
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      const result = await getLastGeminiReviewTimestamp(
        github,
        'owner',
        'repo',
        123
      );

      expect(result).toEqual(new Date('2026-02-20T12:00:00Z'));
    });
  });

  describe('getCommitsSinceTimestamp', () => {
    it('deve retornar apenas commits após o timestamp', async () => {
      const github = createMockGithub();
      const { getCommitsSinceTimestamp } = triggerRereviewModule;

      github.rest.pulls.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'abc123',
            commit: {
              committer: { date: '2026-02-20T10:00:00Z' }
            }
          },
          {
            sha: 'def456',
            commit: {
              committer: { date: '2026-02-20T14:00:00Z' }
            }
          }
        ]
      });

      const sinceTimestamp = new Date('2026-02-20T11:00:00Z');
      const result = await getCommitsSinceTimestamp(
        github,
        'owner',
        'repo',
        123,
        sinceTimestamp
      );

      expect(result).toHaveLength(1);
      expect(result[0].sha).toBe('def456');
    });
  });

  describe('getChangedFiles', () => {
    it('deve retornar lista de arquivos alterados', async () => {
      const github = createMockGithub();
      const { getChangedFiles } = triggerRereviewModule;

      const mockFiles = [
        { filename: 'src/services/medicineService.js', additions: 10, deletions: 5 },
        { filename: 'src/components/Button.jsx', additions: 2, deletions: 1 }
      ];

      github.rest.pulls.listFiles.mockResolvedValue({ data: mockFiles });

      const result = await getChangedFiles(
        github,
        'owner',
        'repo',
        123
      );

      expect(result).toEqual(mockFiles);
    });
  });

  describe('shouldTriggerRereview', () => {
    it('deve retornar true quando arquivo crítico é modificado', async () => {
      const github = createMockGithub();
      const { shouldTriggerRereview } = triggerRereviewModule;

      // Mock do último review
      github.rest.pulls.listReviews.mockResolvedValue({
        data: [
          {
            user: { login: 'gemini-code-assist[bot]' },
            submitted_at: '2026-02-20T10:00:00Z'
          }
        ]
      });
      github.rest.issues.listComments.mockResolvedValue({ data: [] });
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      // Mock de commits
      github.rest.pulls.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'abc123',
            commit: {
              committer: { date: '2026-02-20T14:00:00Z' }
            }
          }
        ]
      });

      // Mock de arquivos alterados (arquivo crítico)
      github.rest.pulls.listFiles.mockResolvedValue({
        data: [
          {
            filename: 'src/services/medicineService.js',
            additions: 5,
            deletions: 2
          }
        ]
      });

      const result = await shouldTriggerRereview(
        123,
        github,
        createMockContext()
      );

      expect(result).toBe(true);
    });

    it('deve retornar true quando mais de 50 linhas são alteradas', async () => {
      const github = createMockGithub();
      const { shouldTriggerRereview } = triggerRereviewModule;

      // Mock do último review
      github.rest.pulls.listReviews.mockResolvedValue({
        data: [
          {
            user: { login: 'gemini-code-assist[bot]' },
            submitted_at: '2026-02-20T10:00:00Z'
          }
        ]
      });
      github.rest.issues.listComments.mockResolvedValue({ data: [] });
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      // Mock de commits
      github.rest.pulls.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'abc123',
            commit: {
              committer: { date: '2026-02-20T14:00:00Z' }
            }
          }
        ]
      });

      // Mock de arquivos alterados (mais de 50 linhas)
      github.rest.pulls.listFiles.mockResolvedValue({
        data: [
          {
            filename: 'src/components/Button.jsx',
            additions: 30,
            deletions: 25
          }
        ]
      });

      const result = await shouldTriggerRereview(
        123,
        github,
        createMockContext()
      );

      expect(result).toBe(true);
    });

    it('deve retornar false quando não há novos commits', async () => {
      const github = createMockGithub();
      const { shouldTriggerRereview } = triggerRereviewModule;

      // Mock do último review
      github.rest.pulls.listReviews.mockResolvedValue({
        data: [
          {
            user: { login: 'gemini-code-assist[bot]' },
            submitted_at: '2026-02-20T15:00:00Z'
          }
        ]
      });
      github.rest.issues.listComments.mockResolvedValue({ data: [] });
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      // Mock de commits (todos antes do review)
      github.rest.pulls.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'abc123',
            commit: {
              committer: { date: '2026-02-20T10:00:00Z' }
            }
          }
        ]
      });

      const result = await shouldTriggerRereview(
        123,
        github,
        createMockContext()
      );

      expect(result).toBe(false);
    });

    it('deve retornar false quando não há review do Gemini', async () => {
      const github = createMockGithub();
      const { shouldTriggerRereview } = triggerRereviewModule;

      github.rest.pulls.listReviews.mockResolvedValue({ data: [] });
      github.rest.issues.listComments.mockResolvedValue({ data: [] });
      github.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      const result = await shouldTriggerRereview(
        123,
        github,
        createMockContext()
      );

      expect(result).toBe(false);
    });
  });

  describe('triggerRereview', () => {
    it('deve postar comentário com /gemini review', async () => {
      const github = createMockGithub();
      const { triggerRereview } = triggerRereviewModule;

      await triggerRereview(123, github, createMockContext());

      expect(github.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('/gemini review')
      });
    });
  });
});
