# AP-T05: Silent Test Debt

**Categoria: Testing & Infrastructure**
**Gravidade: Alta**

## O que é?
É o ato de evoluir o código e criar testes unitários para novas funcionalidades, mas falhar em integrar esses testes à suíte de execução padrão do projeto.

## Por que evitar?
- **Omissão em Review:** Como o teste não roda sozinho, o agente ou revisor pode não notar erros de lint ou lógica nos testes novos.
- **Deterioração de Infra:** Os testes acabam quebrando com o tempo por falta de execução frequente, tornando-se "código morto" pesado de manter.
- **Build Falso-Positivo:** O pipeline do GitHub Actions pode dar "verde" mesmo com o núcleo do sistema (ex: dispatcher de notificações) quebrado, simplesmente por não estar olhando para a pasta certa.

## Como identificar
- Você criou um arquivo `.test.js` fora de `src/`.
- Ao rodar `npm run test`, o número de arquivos testados é o mesmo que antes de você criar o novo teste.
- O lint passa no CI mas você vê "Undefined variable" ao rodar o teste manualmente.

## Correção
Adicione o novo diretório ao `include` do seu `vitest.config.js` ou equivalente.

---
*Identificado em: 2026-04-19 (Estabilização Sprint 6.5)*
