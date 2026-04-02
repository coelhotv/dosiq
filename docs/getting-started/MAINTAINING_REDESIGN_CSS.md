# Guia de Manutenção CSS: Redesign (Santuário Terapêutico)

Este documento orienta desenvolvedores na evolução manual do CSS para o novo sistema visual "Santuário Terapêutico". O foco é manter a integridade arquitetural sem depender de ferramentas de geração automática.

## 1. Arquitetura de Estilos (`src/shared/styles`)

O redesign utiliza uma estrutura modular baseada em arquivos com o sufixo `.redesign.css`. Estes arquivos definem a identidade visual moderna do app e são ativados via atributo `[data-redesign="true"]`. 

- **`tokens.redesign.css`**: Contém as variáveis fundamentais (Cores, Spacing, Shadows). É o "Coração" do sistema.
- **`components.redesign.css`**: Estilização de elementos base de UI (Buttons, Inputs, Cards).
- **`layout.redesign.css`**: Regras de grid e containers para o novo design.

## 2. Como Localizar e Identificar Regras

### Escopo e Ativação
Diferente do CSS global padrão, o redesign é encapsulado. Para ver as mudanças, você deve procurar por seletores dentro de:
```css
[data-redesign="true"] {
  /* Tokens e regras aqui */
}
```

### Onde procurar?
- **Cores Globais:** Procure em `tokens.redesign.css` por variáveis como `--color-primary` (Verde Saúde) ou `--color-secondary` (Azul Clínico).
- **Tipografia:** O redesign utiliza as fontes **Public Sans** (corpo) e **Lexend** (títulos).
- **Componentes:** Se quiser ajustar o arredondamento de um card, procure em `components.redesign.css`.

## 3. Exemplo Real: Modificando Cores e Tokens

No redesign, as cores seguem uma paleta de "saúde e serenidade". Se precisar ajustar a cor primária:

### Antes (`tokens.redesign.css`)
```css
[data-redesign="true"] {
  --color-primary: #006a5e; /* Verde Saúde */
  --color-primary-container: #008577;
}
```

### Depois (Ajuste Seguro)
```css
[data-redesign="true"] {
  --color-primary: #005047; /* Tom mais escuro para melhor contraste */
}
/* O app inteiro que usa var(--color-primary) será atualizado automaticamente */
```

## 4. Evoluindo Componentes (Ex: Botões)

Os botões do redesign são definidos em `components.redesign.css`. Eles utilizam os aliases de tokens para manter a consistência.

```css
/* Exemplo de estrutura em components.redesign.css */
[data-redesign="true"] .btn-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  padding: 12px 24px;
}
```

## 5. Fluxo de Trabalho Seguro (Manual)

1.  **Ative o Redesign:** Adicione `?redesign=1` na URL do seu ambiente de desenvolvimento.
2.  **Localize via DevTools:** Inspecione o elemento. Procure por regras dentro de `[data-redesign="true"]`.
3.  **Identifique a Variável:** Verifique se o valor é fixo ou uma \`var()\`. Se for variável, altere o token em \`tokens.redesign.css\`.
4.  **Teste de Regressão Visual:** Verifique se a mudança não afetou negativamente o design original (sem o atributo \`data-redesign\`). O uso de seletores escopados garante essa segurança.
5.  **Verifique Especificidade:** Regras do redesign têm maior especificidade por causa do seletor de atributo \`[data-redesign="true"]\`.

## 6. Dicas de Debugging no Navegador

- **Tab "Computed":** Use para ver o valor final em pixels que o navegador está renderizando.
- **Filter "Styles":** Digite o nome da variável (ex: \`--color-primary\`) no filtro do DevTools para ver onde ela está definida.
- **Check de Escopo:** Se sua mudança não aparecer, verifique se o elemento pai possui o atributo \`[data-redesign="true"]\`.

---
*Última atualização: 2026-04-02*
