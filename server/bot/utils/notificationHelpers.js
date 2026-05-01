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
 * Retorna saudação contextual por horário para títulos de notificação
 * @param {number} hour - Hora local (0-23)
 * @returns {string}
 */
export function getTimeOfDayGreeting(hour) {
  if (hour >= 5 && hour < 11) return '🌅 Hora dos remédios da manhã';
  if (hour >= 11 && hour < 14) return '🍽️ Hora dos remédios do almoço';
  if (hour >= 14 && hour < 18) return '☕ Hora dos remédios da tarde';
  if (hour >= 18 && hour < 23) return '🌆 Hora dos remédios da noite';
  return '🌙 Hora dos remédios';
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

/**
 * Formata o nome do medicamento com sua dosagem (concentração)
 * Ex: "Omega 3" -> "Omega 3 1200mg"
 * 
 * @param {string} name - Nome do medicamento
 * @param {number} strength - Concentração (dosage_per_pill)
 * @param {string} unit - Unidade da concentração (mg, ml, etc)
 * @returns {string}
 */
export function formatMedicineWithStrength(name, strength, unit) {
  if (!strength) return name;
  return `${name} ${strength}${unit || ''}`;
}

/**
 * Formata a quantidade de tomada (intake) com a unidade apropriada.
 * Diferencia entre unidades de peso (sólidos -> cp) e volume/forma (líquidos -> ml/gotas).
 * 
 * @param {number} quantity - Quantidade a ser tomada
 * @param {string} medicineUnit - Unidade da concentração do medicamento (de DOSAGE_UNITS)
 * @returns {string}
 */
export function formatIntakeQuantity(quantity, medicineUnit) {
  const normalizedUnit = medicineUnit?.toLowerCase();
  
  // Unidades de peso indicam que a "peça" da tomada é um comprimido/cápsula
  const weightUnits = ['mg', 'mcg', 'g', 'ui'];
  
  if (weightUnits.includes(normalizedUnit)) {
    return `${quantity} cp`;
  }
  
  // Unidades de volume ou contagem direta são mantidas
  const keepUnits = ['ml', 'gotas', 'cp'];
  if (keepUnits.includes(normalizedUnit)) {
    return `${quantity} ${normalizedUnit}`;
  }
  
  // Fallback para unidades desconhecidas ou genéricas
  return `${quantity} ${medicineUnit || 'dose'}`;
}
