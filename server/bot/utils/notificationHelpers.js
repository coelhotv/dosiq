/**
 * Helpers compartilhados para construção de mensagens de notificação.
 * Centraliza lógica de saudação e incentivos (Nudges) para uso em Layers 1 e 2.
 */

/**
 * Retorna uma saudação baseada na hora do dia
 * @param {number} hour - Hora local (0-23)
 * @returns {string}
 */
export function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Retorna um incentivo motivacional baseado no percentual de adesão
 * @param {number} percentage - Percentual de 0 a 100
 * @returns {string}
 */
export function getMotivationalNudge(percentage) {
  if (percentage === 100) {
    const wins = [
      "🏆 Imbatível! Sua saúde agradece por tanto compromisso.",
      "🌟 Brilhante! 100% de adesão é o caminho para o sucesso.",
      "✅ Missão cumprida! Você é um exemplo de dedicação."
    ];
    return wins[Math.floor(Math.random() * wins.length)];
  } else if (percentage >= 80) {
    return "📈 Quase lá! Você está indo muito bem. Um pequeno ajuste e chegamos nos 100%!";
  } else if (percentage >= 50) {
    return "⚖️ No caminho certo. Cada dose conta para a sua melhora. Vamos subir essa média?";
  } else if (percentage > 0) {
    return "💪 Não desanime! O importante é recomeçar. Amanhã teremos uma nova chance.";
  } else {
    return "🧘 Respire fundo. Organizar sua rotina é o primeiro passo para o autocuidado.";
  }
}
