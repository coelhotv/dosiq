# Mockup: Health Command Center (Dashboard Redesign)

Este documento descreve a representação visual de alta fidelidade do novo Dashboard, seguindo a estética **Cyberpunk/Neo-Glass**.

## 🎨 Design System & Estética
- **Estilo:** Neo-Glass (Glassmorphism) com transparências e blur (12px).
- **Cores Neon:** Cyan (#00f0ff), Magenta (#ff00ff), Purple (#b000ff).
- **Fundo:** Dark (#0a0a0f) com gradientes radiais sutis.
- **Tipografia:** Orbitron (Títulos/Métricas) e Inter (Conteúdo).

## 📱 Componentes do Mockup (Mobile-First)

### 1. Hero Section: Health Score
- **Visual:** Um medidor circular neon centralizado.
- **Métrica:** Valor "85" em destaque com brilho ciano.
- **Feedback:** Texto "Status: Excelente" com streak de 12 dias em magenta.
- **Efeito:** Conic gradient rotativo suave no fundo do card para sensação de "sistema vivo".

### 2. Smart Alerts (Prioridade Máxima)
- **Tipo:** Card de vidro com borda esquerda colorida por severidade.
- **Exemplo Crítico:** "Dose Atrasada: Escitalopram 10mg" (Borda Vermelha Neon, Ícone ⚠️).
- **Interação:** Sombra pulsante vermelha para atrair atenção imediata.

### 3. Treatment Cards com Titulação
- **Título:** "Pregabalina" com status "Fase 3 de 5".
- **Titulação Stepper:** Uma linha de 5 pontos neon.
    - 2 primeiros em Ciano (Concluídos).
    - 3º em Magenta pulsante (Fase Atual).
    - Últimos 2 em cinza escuro (Pendentes).
- **Info:** Exibição clara da dose atual (150mg) vs. próxima meta (200mg).

### 4. Contextual Quick Actions
- **Grid:** 3 botões de ação rápida no estilo "Glass Tile".
- **Botões:** "Dose Rápida", "Estoque", e um botão de "+" destacado para novas adições.
- **Micro-interação:** Efeito de escala e brilho ao tocar/clicar.

### 5. Mini Timeline (Histórico Recente)
- **Design:** Linha vertical pontilhada ciano com pontos brilhantes.
- **Entradas:** "08:15 - Dose de Vitamina D3 registrada", "Ontem - Meta de hidratação concluída ✨".

---

## 🛠️ Protótipo HTML/CSS Base
O protótipo funcional utilizado para definir este mockup foi criado e está disponível em [`plans/mockup_temp.html`](plans/mockup_temp.html). Ele contém toda a estrutura CSS, animações e tokens de cor definidos para a implementação final.

> **Nota Técnica:** Devido a restrições de ambiente do sistema (falta de bibliotecas de renderização de imagem), o arquivo visual `.png` não pôde ser gerado automaticamente. Recomenda-se abrir o arquivo `plans/mockup_temp.html` em um navegador moderno para visualização real de alta fidelidade.
