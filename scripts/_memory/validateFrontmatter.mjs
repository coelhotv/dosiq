/**
 * Núcleo de validação de frontmatter de memória — spec 079, Slice A.
 *
 * Existe porque `compile-memory-index.mjs` e `validate-memory-schema.mjs` mantinham DUAS
 * implementações da mesma checagem, e elas divergiram em silêncio: o compile parava no primeiro
 * erro do Zod (`issues[0]`) enquanto o standalone já acumulava todos. Cunhar uma memória nova
 * custava quatro rodadas de tentativa e erro porque a sessão alcançava o cego primeiro.
 *
 * FRONTEIRA (RC3/F7 da 079) — este módulo é PURO:
 *   - recebe o objeto de frontmatter já parseado e devolve `issues[]`;
 *   - NÃO lê arquivo, NÃO lê CLAUDE.md, NÃO conhece a flag `strict`.
 * As checagens que dependem de contexto global continuam no `validate-memory-schema.mjs`:
 * `domain ∈ DOMAINS`, o critério O4 (cobertura de domínios) e o filtro zero (`hot` redundante com
 * o CLAUDE.md). Puxá-las para cá colocaria a leitura do CLAUDE.md no caminho crítico de todo commit
 * de memória, que é onde o `--check` do compile passou a rodar.
 *
 * ⚠️ LIMITE ESTRUTURAL, não defeito: `memoryFrontmatterSchema` é uma `z.discriminatedUnion('layer')`.
 * Sem um `layer` válido o Zod não sabe qual branch aplicar e devolve UMA issue no discriminante —
 * os demais campos não são avaliados. "Todos os problemas de uma vez" vale para o arquivo cujo
 * `layer` está correto, que é o caso real de quem está cunhando memória.
 */

import { memoryFrontmatterSchema } from '../schemas/memory-frontmatter.schema.mjs';

/**
 * @typedef {object} FrontmatterIssue
 * @property {string} path          Caminho do campo, já legível ("applies_to.paths"); "(raiz)" quando vazio.
 * @property {string[]} pathSegments Segmentos crus do caminho — o consumidor classifica por `pathSegments[0]`.
 * @property {string} message       Mensagem em uma linha.
 * @property {'applies_to_legado'|'status_invalido'|'zod'} kind Origem da issue, para o consumidor mapear classes.
 */

/**
 * Valida um objeto de frontmatter de memória e devolve TODOS os problemas encontrados.
 * Nunca lança: entrada degenerada (null, string, array) vira issue.
 *
 * @param {unknown} data objeto de frontmatter já parseado
 * @returns {FrontmatterIssue[]} vazio quando o frontmatter é válido
 */
export function validateFrontmatter(data) {
  const issues = [];

  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  if (!isObject) {
    return [
      {
        path: '(raiz)',
        pathSegments: [],
        message: 'frontmatter deve ser um objeto YAML',
        kind: 'zod'
      }
    ];
  }

  // FR-020: applies_to legado (array de tags) é incompatível com applies_to.paths (objeto de globs).
  // Marca `skipZod` porque o schema reprovaria o campo inteiro e afogaria o resto do relatório.
  let skipZod = false;
  if (Array.isArray(data.applies_to)) {
    issues.push({
      path: 'applies_to',
      pathSegments: ['applies_to'],
      message:
        'applies_to legado (array de tags) é incompatível com applies_to.paths (objeto de globs) — mover para legacy_tags',
      kind: 'applies_to_legado'
    });
    skipZod = true;
  }

  // FR-022: layer vazado em status / status obsoleto. Reportado à parte para a mensagem dizer o
  // que fazer; o Zod também reprovaria o enum, e a deduplicação abaixo evita a linha dobrada.
  let statusHandledExplicitly = false;
  if (['hot', 'warm', 'cold'].includes(data.status)) {
    issues.push({
      path: 'status',
      pathSegments: ['status'],
      message: `status "${data.status}" é layer vazado em status — status deve ser active/archived/superseded, layer é campo separado`,
      kind: 'status_invalido'
    });
    statusHandledExplicitly = true;
  } else if (data.status === 'obsolete') {
    issues.push({
      path: 'status',
      pathSegments: ['status'],
      message: 'status "obsolete" deve ser normalizado para "archived"',
      kind: 'status_invalido'
    });
    statusHandledExplicitly = true;
  }

  if (!skipZod) {
    const result = memoryFrontmatterSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        // Já reportado acima com mensagem dedicada — evita duplicar o mesmo defeito.
        if (statusHandledExplicitly && issue.path[0] === 'status') continue;

        const pathSegments = issue.path.map(String);
        issues.push({
          path: pathSegments.join('.') || '(raiz)',
          pathSegments,
          message: issue.message,
          kind: 'zod'
        });
      }
    }
  }

  return issues;
}

/**
 * Formata as issues em uma string multi-linha, no formato que os dois consumidores já usavam
 * (`Campo "<caminho>": <mensagem>`). Mantido aqui para os dois formatarem igual.
 *
 * @param {FrontmatterIssue[]} issues
 * @returns {string}
 */
export function formatIssues(issues) {
  return issues.map((issue) => `Campo "${issue.path}": ${issue.message}`).join('\n');
}
